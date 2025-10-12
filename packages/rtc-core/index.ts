export type PeerMap = Map<string, RTCPeerConnection>;

export function createPeer(onTrack: (ev: RTCTrackEvent, from: string)=>void) {
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: ["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"] }
    ]
  });
  pc.ontrack = (ev) => onTrack(ev, (pc as any).__peerId || "unknown");
  return pc;
}

export function addLocalTracks(pc: RTCPeerConnection, stream: MediaStream) {
  stream.getTracks().forEach(t => pc.addTrack(t, stream));
}

export async function makeOffer(pc: RTCPeerConnection) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function acceptOffer(pc: RTCPeerConnection, offer: RTCSessionDescriptionInit) {
  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export async function acceptAnswer(pc: RTCPeerConnection, answer: RTCSessionDescriptionInit) {
  await pc.setRemoteDescription(answer);
}

export function setPeerId(pc: RTCPeerConnection, id: string) {
  (pc as any).__peerId = id;
}