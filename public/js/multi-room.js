const socket = io();
const videoGrid = document.getElementById('video-grid');
const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};

const HEROKU_SECURE_PORT = 443;

const peer = new Peer(undefined, {path: '/peerjs', host: '/', port: 3000});


let myVideoStream;
navigator.mediaDevices.getUserMedia({video: true, audio: true}).then(function(stream) {
    myVideoStream = stream;
    addVideoStream(myVideo, stream);

    peer.on('call', call => {
        call.answer(stream);
        const video = document.createElement('video');
        call.on('stream', userVideoStream => {
            addVideoStream(video, userVideoStream)
        })
    });

    socket.on('user-connected', function(userId){
        connectNewUser(userId, stream);
    });

    // input value
    let text = $("input");
    // when press enter send message
    $('html').keydown(function (e) {
        if (e.which === 13 && text.val().length !== 0) {
            socket.emit('message', text.val());
            text.val('')
        }
    });
    socket.on("createMessage", (message, userId) => {
        $("ul").append(`<li class="message"><b>${userId}</b><br/>${message}</li>`);
        scrollToBottom()
    })
});

socket.on('user-disconnected', userId => {
    if (peers[userId]) peers[userId].close();
});

peer.on('open', id => {
    socket.emit('join-room', ROOM_ID, id);
});

function connectNewUser(userId, stream) {
    const call = peer.call(userId, stream);
    const video = document.createElement('video');
    call.on('stream', userVideoStream => { addVideoStream(video, userVideoStream)});
    call.on('close', () => {video.remove()});

    peers[userId] = call;
}

const addVideoStream = (video, stream) => {
    video.srcObject = stream;
    video.addEventListener('loadedmetadata', () => {
        video.play();
    });
    videoGrid.append(video);
};

const scrollToBottom = () => {
    var d = $('.main__chat_window');
    d.scrollTop(d.prop("scrollHeight"));
};

const muteUnmute = () => {
    const enabled = myVideoStream.getAudioTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    } else {
        setMuteButton();
        myVideoStream.getAudioTracks()[0].enabled = true;
    }
};

const playStop = () => {
    console.log('object');
    let enabled = myVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        myVideoStream.getVideoTracks()[0].enabled = false;
        setPlayVideo()
    } else {
        setStopVideo();
        myVideoStream.getVideoTracks()[0].enabled = true;
    }
};

const showSecurityInfo = () => {
  console.log("Show Security!");
  let activeShield3 = document.querySelector('.shield-on');
  if (activeShield3) {
      setSecurityButton()
  } else {
      setShowSecurityButton()
  }
};

const showParticipants = () => {
    console.log("Show users");
};

let mode = "camera";
let videoIsPaused;
const swapDisplay = () => {
    // Store swap button icon and text
    const swapIcon = document.getElementById("swap-icon-display");
    const swapText = document.getElementById("swap-text-display");

    if (mode === "camera") {
        // Show accept screen-share snackbar
        Snackbar.show({
            text: "Please allow screen share. Click the middle of the picture above and then press share.",
            width: "400px",
            pos: "bottom-center",
            actionTextColor: "#616161",
            duration: 50000,
        });

        // Request screen share, note we dont want to capture audio
        // as we already have the stream from the Webcam
        navigator.mediaDevices.getDisplayMedia({video: true, audio: false}).then(function (stream){
            // Close allow screen-share snackbar
            Snackbar.close();

            // Change display mode
            mode = "screen";

            // Update swap button icon and text
            swapIcon.classList.remove("fa-desktop");
            swapIcon.classList.add("fa-camera");
            swapText.innerText = "Share Webcam";

            switchMultiStreamHelper(stream);
        }).catch(function (err) {
            console.log(err);
            console.log("Error sharing screen");
            Snackbar.close();
        });
        // If mode is screen-share then switch to webcam
    } else {
        // Stop the screen share track
        myVideo.srcObject.getTracks().forEach((track) => track.stop());
        // Get webcam input
        navigator.mediaDevices.getUserMedia({video: true, audio: true,}).then(function (stream) {
                // Change display mode
                mode = "camera";

                // Update swap button icon and text
                swapIcon.classList.remove("fa-camera");
                swapIcon.classList.add("fa-desktop");
                swapText.innerText = "Share Screen";
            switchMultiStreamHelper(stream);
        });
    }
};

// Swap current video track with passed in stream
function switchMultiStreamHelper(stream) {
    console.log(stream.id);
    let token = stream.id;

    // Get current video track
    let videoTrack = stream.getVideoTracks()[0];

    // Add listen for if the current track swaps, swap back
    videoTrack.onended = function () {swapDisplay();};

    // Update local video stream
    myVideoStream = videoTrack;

    // Update local video object
    myVideo.srcObject = stream;

    // Unpause video on swap
    if (videoIsPaused) {
        playStop();
    }

}
// End swap camera / screen share


const setSecurityButton = () => {
    document.querySelector('.main__security_button').innerHTML = `
    <i class="shield-reload fas fa-shield-alt"></i>
    <span>Security</span>
  `;
};

const setShowSecurityButton = () => {
    document.querySelector('.main__security_button').innerHTML = `
    <i class="shield-on fas fa-shield-alt"></i>
    <span>Minsystems Shield 3 On</span>
  `;
};

const setMuteButton = () => {
    document.querySelector('.main__mute_button').innerHTML = `
    <i class="fas fa-microphone"></i>
    <span>Mute</span>
  `;
};

const setUnmuteButton = () => {
    document.querySelector('.main__mute_button').innerHTML = `
    <i class="unmute fas fa-microphone-slash"></i>
    <span>Unmute</span>
  `;
};

const setStopVideo = () => {
    document.querySelector('.main__video_button').innerHTML = `
    <i class="fas fa-video"></i>
    <span>Stop Video</span>
  `;
};

const setPlayVideo = () => {
    document.querySelector('.main__video_button').innerHTML = `
  <i class="stop fas fa-video-slash"></i>
    <span>Play Video</span>
  `;
};
