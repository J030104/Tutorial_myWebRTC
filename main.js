// import AgoraRTM from 'agora-rtm-sdk'; // In the <script>

// let APP_ID = "bf9c81563ed6419fbf68d844b1e6bac3";
let APP_ID = "db7a0fcbaaa8444aba5e88aa98ef1fe4";

/**
 * By using the same App ID across different client instances,
 * we're essentially allowing multiple users to interact within 
 * the same project environment provided by Agora, which facilitates 
 * the real-time engagement aspect of their services.
*/

/**
 * Agora offers a cloud-based platform that facilitates real-time 
 * communication and engagement within applications. It’s infrastructure
 * handles the signaling, media streams, and other communication aspects,
 * allowing users to interact seamlessly.
 */

let token0 = null;
// let token = "007eJxTYBDoLt/y5bcci9YXtnfvdF8rMjgsnjTbdloVz/XY5GK2vvsKDElplskWhqZmxqkpZiaGlmlJaWYWKRYmJkmGqWZJicnGa13t0hoCGRlCi+4yMzJAIIjPwpCbmJnHwAAAJcse9A==";
let uid = String(Math.floor(Math.random() * 10000))

let client;
let channel;

let queryString = window.location.search
let urlParams = new URLSearchParams(queryString)
let roomId = urlParams.get('room')

if (!roomId) {
    window.location = 'lobby.html'
}

let localStream; // Video and audio data
let remoteStream;
let peerConnection; // The description ?

// new RTCPeerConnection(configuration) 
const servers = { // An object
    // Parameters in here
    iceServers: [ // An array of objects
        {
            // This required property is either a single string or an array of strings
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
}

let init = async () => {
    client = await AgoraRTM.createInstance(APP_ID)
    await client.login({ uid, token0 })
    // await client.login({ token: token0, uid: uid.toString() })

    // index.html?room=13579
    // channel = client.createChannel("main") // It either creates one or find the channel "main"
    channel = client.createChannel(roomId) // It either creates one or find the channel "main"
    await channel.join()

    /**
     * The user can receive channel messages and notifications 
     * of other users joining or leaving the channel.
     */

    // This is addEventListener
    channel.on("MemberJoined", handleUserJoined) // It triggers when another user joins the channel.
    channel.on("MemberLeft", handleUserLeft)

    client.on("MessageFromPeer", handleMessageFromPeer) // * Got stuck *
    // ch.on("ChannelMessage", handleMessageFromPeer)

    // Request for permission
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    document.getElementById('user-1').srcObject = localStream
}

let handleUserJoined = async (MemberId) => {
    console.log("A new user joined the channel: ", MemberId)
    createOffer(MemberId)
}

let handleUserLeft = (MemberId) => {
    document.getElementById('user-2').style.display = 'none'
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text)
    // console.log("Message: ", message)
    if (message.type === "offer") { // An offer received
        createAnswer(MemberId, message.offer)
    } else if (message.type === "answer") {
        addAnswer(message.answer)
    } else if (message.type === "candidate") {
        if (peerConnection) { // Have a check
            peerConnection.addIceCandidate(message.candidate)
        }
    }

}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers)

    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream
    document.getElementById('user-2').style.display = 'block'

    // Check again if somehow the localStream is not created like refreshing
    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        document.getElementById('user-1').srcObject = localStream
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    })
    /** 
     * Only tracks are sent from one peer to another, not streams.
     * The streams are a way to group tracks together on the receiving
     * end of the connection, making sure they are synchronized
     * 
     * Any tracks that are added to the same stream on the local end 
     * of the connection will be on the same stream on the remote end.
     * 
     * Since streams are specific to each peer, specifying one or more streams 
     * means the other peer will create a corresponding stream (or streams) 
     * automatically on the other end of the connection, and will then
     * automatically add the received track to those streams.
     * 
    */

    // Add remote tracks
    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track)
        })
    }

    // setLocalDescription() will fire this off
    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            await client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': event.candidate }) }, MemberId)
            // console.log("New ICE candatite:", event.candidate)
        }
    }
}

let createOffer = async (MemberId) => {
    await createPeerConnection(MemberId)

    let offer = await peerConnection.createOffer()
    await peerConnection.setLocalDescription(offer)

    // I added the await to make sure the message is sent before the console.log
    await client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, MemberId)
    // client.sendMessageToPeer("Hi~", MemberId)

    console.log('Member ' + MemberId + ' sent the offer.')
}

let createAnswer = async (MemberId, offer) => { // The MemeberId should be the user-2's.
    try {
        await createPeerConnection(MemberId)

        await peerConnection.setRemoteDescription(offer)

        let answer = await peerConnection.createAnswer()
        await peerConnection.setLocalDescription(answer)
        
        // I added the await to make sure the message is sent before the console.log
        await client.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, MemberId)
        console.log('Member ' + MemberId + ' responded with the answer.')
    } catch (err) {
        console.error(err)
    }
}

let addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) { // If that doesn't exist
        peerConnection.setRemoteDescription(answer)
    }
}

let leaveChannel = async () => {
    await channel.leave()
    await client.logout()
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video')

    if (videoTrack.enabled) {
        videoTrack.enabled = false
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        videoTrack.enabled = true
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(180, 100, 250, .9)'
    }
}

let toggleMic = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio')

    if (audioTrack.enabled) {
        audioTrack.enabled = false
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)'
    } else {
        audioTrack.enabled = true
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(180, 100, 250, .9)'
    }
}

window.addEventListener('beforeunload', leaveChannel) // ?

document.getElementById('camera-btn').addEventListener('click', toggleCamera)
document.getElementById('mic-btn').addEventListener('click', toggleMic)

init()