const COOKIE = "ss_session";
const SESSION_DAYS = 7;
const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers });

function randomId(bytes = 18) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map(x => x.toString(16).padStart(2, "0")).join("");
}
function cookieValue(request, name) {
  const raw = request.headers.get("Cookie") || "";
  const item = raw.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}
function cookieHeader(value, maxAge) {
  return `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
async function digest(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function passwordHash(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 150000, hash: "SHA-256" }, material, 256);
  return [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function currentUser(request, env) {
  const token = cookieValue(request, COOKIE);
  if (!token) return null;
  const tokenHash = await digest(token);
  const row = await env.DB.prepare(
    "SELECT users.id, users.workspace_id, users.name, users.email, users.role FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=? AND sessions.expires_at>?"
  ).bind(tokenHash, new Date().toISOString()).first();
  return row || null;
}
async function newSession(userId, env) {
  const token = randomId(32);
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await digest(token), userId, expires).run();
  return token;
}
async function requireDb(env) {
  if (!env.DB) throw new Error("The D1 database binding named DB is not configured.");
}
export async function onRequestGet({ request, env }) {
  try {
    await requireDb(env);
    const user = await currentUser(request, env);
    if (!user) return json({ authenticated: false }, 401);
    const data = await env.DB.prepare("SELECT brand_json,reviews_json FROM workspace_data WHERE workspace_id=?").bind(user.workspace_id).first();
    const workspace = await env.DB.prepare("SELECT name,invite_code FROM workspaces WHERE id=?").bind(user.workspace_id).first();
    return json({
      authenticated: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      workspace,
      brand: data ? JSON.parse(data.brand_json) : null,
      reviews: data ? JSON.parse(data.reviews_json) : []
    });
  } catch (error) {
    return json({ error: error.message || "Workspace service unavailable." }, 503);
  }
}
export async function onRequestPost({ request, env }) {
  try {
    await requireDb(env);
    const body = await request.json();
    if (body.action === "logout") {
      const token = cookieValue(request, COOKIE);
      if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(token)).run();
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader("", 0) });
    }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 10) {
      return json({ error: "Enter a valid email and a password with at least 10 characters." }, 400);
    }
    if (body.action === "login") {
      const user = await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
      if (!user || await passwordHash(password, user.password_salt) !== user.password_hash) return json({ error: "Email or password is incorrect." }, 401);
      const token = await newSession(user.id, env);
      return json({ ok: true }, 200, { "Set-Cookie": cookieHeader(token, SESSION_DAYS * 86400) });
    }
    if (body.action === "signup") {
      const name = String(body.name || "").trim().slice(0, 80);
      const workspaceName = String(body.workspaceName || "").trim().slice(0, 80);
      if (!name || (!body.inviteCode && !workspaceName)) return json({ error: "Name and workspace name are required when creating a workspace." }, 400);
      const exists = await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
      if (exists) return json({ error: "An account with this email already exists. Please sign in." }, 409);
      let workspace;
      if (body.inviteCode) {
        workspace = await env.DB.prepare("SELECT id FROM workspaces WHERE invite_code=?").bind(String(body.inviteCode).trim()).first();
        if (!workspace) return json({ error: "That workspace invite code was not found." }, 404);
      } else {
        workspace = { id: randomId(12) };
        await env.DB.prepare("INSERT INTO workspaces(id,name,invite_code,created_at) VALUES(?,?,?,?)")
          .bind(workspace.id, workspaceName, randomId(5).toUpperCase(), new Date().toISOString()).run();
      }
      const salt = randomId(16);
      const role = body.inviteCode ? (body.role === "reviewer" ? "reviewer" : "creator") : "admin";
      const userId = randomId(12);
      await env.DB.prepare("INSERT INTO users(id,workspace_id,name,email,password_hash,password_salt,role,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .bind(userId, workspace.id, name, email, await passwordHash(password, salt), salt, role, new Date().toISOString()).run();
      if (!body.inviteCode) {
        const initialBrand = body.brand && typeof body.brand === "object" ? JSON.stringify(body.brand) : "{}";
        await env.DB.prepare("INSERT INTO workspace_data(workspace_id,brand_json,reviews_json,updated_at) VALUES(?,?,?,?)")
          .bind(workspace.id, initialBrand, "[]", new Date().toISOString()).run();
      }
      const token = await newSession(userId, env);
      return json({ ok: true }, 201, { "Set-Cookie": cookieHeader(token, SESSION_DAYS * 86400) });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (error) {
    return json({ error: error.message || "Could not complete account action." }, 503);
  }
}
export async function onRequestPut({ request, env }) {
  try {
    await requireDb(env);
    const user = await currentUser(request, env);
    if (!user) return json({ error: "Please sign in to sync this workspace." }, 401);
    const body = await request.json();
    const current = await env.DB.prepare("SELECT brand_json,reviews_json FROM workspace_data WHERE workspace_id=?").bind(user.workspace_id).first();
    if (!current) return json({ error: "Workspace data was not initialized." }, 404);
    const canEditBrand = ["admin", "creator"].includes(user.role);
    const brand = canEditBrand && body.brand ? JSON.stringify(body.brand) : current.brand_json;
    let reviews = current.reviews_json;
    if (Array.isArray(body.reviews)) {
      const oldReviews = JSON.parse(current.reviews_json || "[]");
      const nextReviews = body.reviews;
      const oldById = new Map(oldReviews.map(item => [item.id, item]));
      if (user.role === "reviewer") {
        if (nextReviews.length !== oldReviews.length || nextReviews.some(item => !oldById.has(item.id))) {
          return json({ error: "Reviewer accounts can update existing reviews but cannot create or delete submissions." }, 403);
        }
      }
      if (user.role === "creator") {
        const nextById = new Map(nextReviews.map(item => [item.id, item]));
        if (oldReviews.some(item => !nextById.has(item.id) || nextById.get(item.id).status !== item.status)) {
          return json({ error: "Content creators cannot change reviewer decisions or delete history." }, 403);
        }
        if (nextReviews.some(item => !oldById.has(item.id) && item.status !== "Pending")) {
          return json({ error: "New creator submissions must start as Pending." }, 403);
        }
      }
      reviews = JSON.stringify(nextReviews);
    }
    await env.DB.prepare("UPDATE workspace_data SET brand_json=?,reviews_json=?,updated_at=? WHERE workspace_id=?")
      .bind(brand, reviews, new Date().toISOString(), user.workspace_id).run();
    return json({ ok: true, brandUpdated: canEditBrand && !!body.brand, reviewsUpdated: Array.isArray(body.reviews) });
  } catch (error) {
    return json({ error: error.message || "Could not save workspace data." }, 503);
  }
}
