import http from "http";
import { WebSocketServer } from "ws";

const server = http.createServer();
const wss = new WebSocketServer({ server });

/** rooms: { [roomId]: Map<clientId, { ws, role, admitted:boolean }> } */
const rooms = new Map();

function ensureRoom(room){
  if(!rooms.has(room)) rooms.set(room, new Map());
  return rooms.get(room);
}

function send(ws, msg){
  try{ ws.readyState === 1 && ws.send(JSON.stringify(msg)); }catch{}
}
function broadcast(roomMap, exceptId, msg){
  for(const [cid, c] of roomMap.entries()){
    if(cid === exceptId) continue;
    send(c.ws, msg);
  }
}

wss.on("connection", (ws) => {
  let roomId = null, clientId = null, role = null;

  send(ws, {_type:"_open"});

  ws.on("message", (buf)=>{
    let m; try{ m = JSON.parse(buf.toString()); }catch{ return; }

    if(m.type === "join" && m.room && m.id){
      roomId = m.room; clientId = m.id; role = m.role || "guest";
      const rm = ensureRoom(roomId);
      rm.set(clientId, { ws, role, admitted: role === "clinician" }); // clinician auto-admitted
      // notify others
      broadcast(rm, clientId, { type:"join", id: clientId, role });
      return;
    }

    if(!roomId || !clientId) return;
    const rm = rooms.get(roomId); if(!rm) return;

    // Lobby: patient knocks; clinician admits/rejects
    if(m.type === "knock"){
      broadcast(rm, clientId, { type:"knock", id: clientId });
      return;
    }
    if(m.type === "admit" && m.target){
      const t = rm.get(m.target); if(t){ t.admitted = true; send(t.ws, { type:"admitted" }); }
      return;
    }
    if(m.type === "reject" && m.target){
      const t = rm.get(m.target); if(t){ send(t.ws, { type:"rejected" }); }
      return;
    }

    const me = rm.get(clientId);
    const forwardable = new Set(["offer","answer","ice","chat","typing","ctrl"]);
    if(forwardable.has(m.type)){
      // only forward WebRTC if sender is admitted or is clinician
      if((m.type==="offer"||m.type==="answer"||m.type==="ice") && !(me?.admitted)) return;
      broadcast(rm, clientId, {...m, id: clientId});
    }
  });

  ws.on("close", ()=>{
    if(roomId && clientId){
      const rm = rooms.get(roomId);
      if(rm){
        rm.delete(clientId);
        broadcast(rm, clientId, { type:"leave", id: clientId });
        if(rm.size === 0) rooms.delete(roomId);
      }
    }
  });

  ws.on("error", ()=> send(ws, {_type:"_error"}));
});

server.listen(8787, ()=> console.log("[signal] listening on ws://localhost:8787"));