class RTSPWebRTCPlayer {
  constructor() {
    this.webrtc = null;
    this.connectionAttempts = 0;
    this.maxRetries = 4;
    this.isConnected = false;
    this.isTrackStarted = false;
    
    this.elements = {
      streamPath: document.getElementById('streamPath'),
      serverUrl: document.getElementById('serverUrl'),
      username: document.getElementById('username'),
      password: document.getElementById('password'),
      playBtn: document.getElementById('playBtn'),
      stopBtn: document.getElementById('stopBtn'),
      video: document.getElementById('video'),
      statusDisplay: document.getElementById('statusDisplay'),
      statusText: document.getElementById('statusText'),
      connectionInfo: document.getElementById('connectionInfo'),
      connectionDetails: document.getElementById('connectionDetails'),
      playerWrap: document.getElementById('playerWrap')
    };
    
    this.statusMessages = {
      connecting: 'Connecting to stream...',
      connected: 'Connected to server',
      loading: 'Loading stream...',
      disconnected: 'Disconnected from server',
      closed: 'Connection closed',
      failed: 'Connection failed',
      noUrl: 'Please enter a stream path',
      reconnecting: 'Reconnecting...',
      ready: 'Ready to connect'
    };
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.elements.playBtn.addEventListener('click', () => this.startPlay());
    this.elements.stopBtn.addEventListener('click', () => this.stopPlay());
    this.elements.video.addEventListener('loadeddata', () => this.onStreamStarted());
    this.elements.video.addEventListener('emptied', () => this.onStreamEmptied());
  }
  
  updateStatus(message, type = 'info') {
    this.elements.statusText.textContent = message;
    this.elements.statusDisplay.className = `status-display ${type}`;
    this.elements.statusDisplay.classList.remove('hidden');
  }
  
  updateConnectionInfo(details) {
    this.elements.connectionDetails.textContent = details;
    this.elements.connectionInfo.classList.remove('hidden');
  }
  
  async startPlay() {
    const streamPath = this.elements.streamPath.value.trim();
    const serverUrl = this.elements.serverUrl.value.trim();
    
    if (!streamPath) {
      this.updateStatus(this.statusMessages.noUrl, 'error');
      return;
    }
    
    this.connectionAttempts += 1;
    this.updateStatus(this.statusMessages.connecting, 'info');
    this.elements.playBtn.disabled = true;
    this.elements.stopBtn.disabled = false;
    this.elements.video.srcObject = null;
    this.isTrackStarted = false;
    
    try {
      await this.createWebRTCConnection(streamPath, serverUrl);
    } catch (error) {
      this.updateStatus(`Connection failed: ${error.message}`, 'error');
      this.elements.playBtn.disabled = false;
      this.elements.stopBtn.disabled = true;
    }
  }
  
  async createWebRTCConnection(streamPath, serverUrl) {
    const url = `${serverUrl}/${streamPath}/whep`;
    
    this.webrtc = new RTCPeerConnection();
    
    // Handle incoming tracks
    this.webrtc.ontrack = (event) => {
      if (this.elements.video && event.streams[0]) {
        this.elements.video.srcObject = event.streams[0];
        this.elements.video.load();
        this.updateStatus(this.statusMessages.connected, 'success');
      }
    };
    
    // Handle connection state changes
    this.webrtc.onconnectionstatechange = () => {
      switch (this.webrtc.connectionState) {
        case "new":
          this.updateStatus(this.statusMessages.connecting, 'info');
          break;
        case "connected":
          this.updateStatus(this.statusMessages.loading, 'info');
          this.isConnected = true;
          break;
        case "disconnected":
          this.updateStatus(this.statusMessages.disconnected, 'warning');
          this.isTrackStarted = false;
          this.isConnected = false;
          break;
        case "closed":
          this.updateStatus(this.statusMessages.closed, 'warning');
          this.isTrackStarted = false;
          this.isConnected = false;
          break;
        case "failed":
          this.updateStatus(this.statusMessages.failed, 'error');
          this.isTrackStarted = false;
          this.isConnected = false;
          break;
      }
    };
    
    // Add transceiver for video
    this.webrtc.addTransceiver('video', { direction: 'sendrecv' });
    
    // Handle negotiation
    this.webrtc.onnegotiationneeded = async () => {
      try {
        const offer = await this.webrtc.createOffer();
        await this.webrtc.setLocalDescription(offer);
        
        // Prepare headers with authentication
        const headers = {
          'Content-Type': 'application/sdp'
        };
        
        const username = this.elements.username.value;
        const password = this.elements.password.value;
        if (username && password) {
          headers['Authorization'] = 'Basic ' + btoa(username + ':' + password);
        }
        
        const response = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: this.webrtc.localDescription.sdp
        });
        
        if (!response.ok) {
          throw new Error(`WHEP server error: ${response.status} ${response.statusText}`);
        }
        
        const answerSDP = await response.text();
        await this.webrtc.setRemoteDescription({
          type: 'answer',
          sdp: answerSDP
        });
        
        this.updateConnectionInfo(`Connected to: ${url}`);
        
      } catch (error) {
        this.webrtc.close();
        throw error;
      }
    };
    
    // Handle errors
    this.webrtc.onerror = (error) => {
      this.updateStatus('WebRTC connection error', 'error');
    };
    
    this.elements.playerWrap.classList.remove('hidden');
  }
  
  stopPlay() {
    if (this.webrtc) {
      this.webrtc.close();
      this.webrtc = null;
    }
    
    this.elements.video.srcObject = null;
    this.elements.playBtn.disabled = false;
    this.elements.stopBtn.disabled = true;
    this.isConnected = false;
    this.isTrackStarted = false;
    this.connectionAttempts = 0;
    
    this.updateStatus(this.statusMessages.ready, 'info');
    this.elements.playerWrap.classList.add('hidden');
    this.elements.connectionInfo.classList.add('hidden');
  }
  
  onStreamStarted() {
    this.isTrackStarted = true;
    this.updateStatus('Stream started successfully', 'success');
  }
  
  onStreamEmptied() {
    setTimeout(() => {
      if (!this.isTrackStarted && this.connectionAttempts < this.maxRetries && this.isConnected) {
        this.updateStatus(this.statusMessages.reconnecting, 'warning');
        this.startPlay();
      }
    }, 4000);
  }
}

// Initialize the player when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new RTSPWebRTCPlayer();
});
