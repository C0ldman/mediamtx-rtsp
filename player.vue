<template>
  <div>
    <div v-show="isTrackStarted" class="player-wrap">
      <video
        ref="webrtc"
        class="video-player"
        :poster="poster"
        :style="`width:${width}`"
        autoplay
        muted
        playsinline
        @loadeddata="streamStarted"
        @emptied="emptiedHandler"></video>
    </div>
    <div class="slot-wrapper">
      <slot ></slot>
    </div>
    <v-layout v-if="!isTrackStarted" class="connection-status">
      <div>
        <v-col>
          <v-row>
            {{ connectionStatus }}
          </v-row>
          <v-row>
            <v-img :src="poster" ma-2></v-img>
          </v-row>
        </v-col>
      </div>
    </v-layout>
  </div>
</template>

<script lang="ts">
import Vue from 'vue';
import Component from "vue-class-component";
import { Watch } from 'vue-property-decorator';
import {
  Strings
} from "@/utils/constants";

@Component({
  props: {
    streamPath: {
      type: String,
      default: ''
    },
    poster: {
      type: String,
      default: ''
    },
    width: {
      type: String,
      default: '100%'
    }
  }
})
export default class WebrtcPlayer extends Vue {
  streamPath?: string;
  connectionStatus: string = this.strings[Strings.RTC_PLAYER_STATUS_TRY_TO_CONNECT];
  isTrackStarted:Boolean = false;
  webrtc:any;
  connectionAttempts:number = 0;

  get strings() {
    return this.$store.getters['localization/localeStrings'];
  }

  startPlay(videoEl: any, url: string | undefined = '', component: WebrtcPlayer) {
    if (!url) return;

    this.connectionAttempts += 1;

    component.webrtc = new RTCPeerConnection();

    component.webrtc.ontrack = function (event:any) {
      if (videoEl && event.streams[0]) {
        videoEl.srcObject = event.streams[0];
        videoEl.load();
      }
    };

    component.webrtc.onconnectionstatechange = () => {
      switch (component.webrtc.connectionState) {
        case "new":
          component.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_CONNECTING];
          break;
        case "connected":
          component.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_LOAD_STREAM];
          break;
        case "disconnected":
          component.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_DISCONNECT];
          component.isTrackStarted = false;
          break;
        case "closed":
          component.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_CLOSED];
          component.isTrackStarted = false;
          break;
        case "failed":
          component.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_FAILED];
          component.isTrackStarted = false;
          break;
      }
    };

    component.webrtc.addTransceiver('video', {direction: 'sendrecv'});

    component.webrtc.onnegotiationneeded = async function handleNegotiationNeeded() {
      const offer = await component.webrtc.createOffer();

      await component.webrtc.setLocalDescription(offer);

      fetch(url, {
        method: 'POST',
        // @ts-ignore
        body: new URLSearchParams({data: btoa(component.webrtc.localDescription.sdp)})
      })
          .then(response => {
            if (response.status === 500) {
              throw Error(this.strings[Strings.RTC_PLAYER_ERROR_FAILED_TO_LOAD]);
            }
            return response.text();
          })
          .then(data => {
            component.webrtc.setRemoteDescription(new RTCSessionDescription({
                type: 'answer',
                sdp: atob(data)
              }));
          })
          .catch((e) => {
            component.webrtc.close();
          });
    };

    component.webrtc.onerror = (e: any) => console.log('Error ' + e);

    const webrtcSendChannel = component.webrtc.createDataChannel('rtsptowebSendChannel');
    webrtcSendChannel.onopen = () => {
      webrtcSendChannel.send('ping');
    };
    webrtcSendChannel.onclose = () => {
      component.isTrackStarted = false;
      component.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_FAILED];
    };

    webrtcSendChannel.onmessage = (event:any) => console.log(event.data);
  }

  mounted() {
    if (!this.streamPath) this.connectionStatus = this.strings[Strings.RTC_PLAYER_STATUS_NO_URL];
    this.startPlay(this.$refs.webrtc, this.streamPath, this);
  }

  beforeDestroy() {
    if (this.webrtc) this.webrtc.close();
  }

  streamStarted() {
    this.isTrackStarted = true;
  }

  emptiedHandler() {
    setTimeout(() => {
      if (!this.isTrackStarted && this.connectionAttempts < 4) {
        this.connectionStatus = 'Reconnecting...';
        this.startPlay(this.$refs.webrtc, this.streamPath, this);
      }
    }, 4000);
  }

  @Watch('streamPath')
  onStreamPathChanged() {
    this.isTrackStarted = false;
    this.startPlay(this.$refs.webrtc, this.streamPath, this);
  }
}
</script>

<style scoped>
.player-wrap {
  position: relative;
}

.video-player {
  height: auto;
}

.slot-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: auto;
  height: auto;
}
</style>
