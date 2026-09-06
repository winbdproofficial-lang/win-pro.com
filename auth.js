const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');
function hashToken(token){return crypto.createHash('sha256').update(token).digest('hex');}
function signAccess(user){return jwt.sign({sub:user.id,role:user.role,username:user.username},process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'15m'});}
async function issueRefresh(userId){
  const raw=crypto.randomBytes(48).toString('base64url');
  const days=Math.max(1,Number(process.env.REFRESH_TOKEN_DAYS||30));
  await pool.query("INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,now()+($3 || ' days')::interval)",[userId,hashToken(raw),days]);
  return raw;
}
async function revokeRefresh(raw,userId=null){
  if(!raw)return;
  if(userId) await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND token_hash=$2 AND revoked_at IS NULL',[userId,hashToken(raw)]);
  else await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL',[hashToken(raw)]);
}
function authRequired(req,res,next){
  try{
    const header=req.get('authorization')||'';const token=header.startsWith('Bearer ')?header.slice(7):null;
    if(!token)return res.status(401).json({success:false,message:'Authentication required'});
    req.user=jwt.verify(token,process.env.JWT_SECRET);next();
  }catch{res.status(401).json({success:false,message:'Invalid or expired access token'});}
}
module.exports={hashToken,signAccess,issueRefresh,revokeRefresh,authRequired};
