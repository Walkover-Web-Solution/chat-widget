// useCallUI.ts
import { useState, useEffect } from 'react';
import helloVoiceService from './HelloVoiceService';

export const useCallUI = () => {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "ended">("idle");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<any>(null);
  const [timer, setTimer] = useState<number>(0);

  useEffect(() => {
    // Initialize service if not already done
    // if (!helloVoiceService.isInitialized()) {
    // helloVoiceService.initialize();
    // }

    // Set initial state
    setCallState(helloVoiceService.getCallState());
    setIsMuted(helloVoiceService.getMuteStatus());

    // Set up event listeners
    const handleCallStateChange = ({ state, mediaStream, data }: any) => {
      setCallState(state);
      if (mediaStream) {
        setMediaStream(mediaStream);
      }
    };

    const handleTimerUpdate = ({ state, data }: any) => {
      if (state === 'connected' && typeof data?.answeredAt === 'string' && data.answeredAt) {
        // Calculate elapsed time since call was answered
        const answeredTime = new Date(data.answeredAt).getTime();
        const currentTime = new Date().getTime();
        const elapsedSeconds = Math.floor((currentTime - answeredTime) / 1000);
        // Set timer to the elapsed time (if positive)
        if (elapsedSeconds > 0) {
          setTimer(elapsedSeconds);
        }
        console.log("Call answered at:", data.answeredAt, "Elapsed seconds:", elapsedSeconds);
      } else if (state === 'ended' || state === 'error') {
        // Reset timer when call ends
        setTimer(0);
      }
    };

    const handleMuteChange = ({ muted }: any) => {
      setIsMuted(muted);
    };

    helloVoiceService.addEventListener("callStateChanged", handleCallStateChange);
    helloVoiceService.addEventListener("muteStatusChanged", handleMuteChange);
    helloVoiceService.addEventListener("handleTimerUpdate", handleTimerUpdate);

    // Clean up event listeners
    return () => {
      helloVoiceService.removeEventListener("callStateChanged", handleCallStateChange);
      helloVoiceService.removeEventListener("muteStatusChanged", handleMuteChange);
      helloVoiceService.removeEventListener("handleTimerUpdate", handleTimerUpdate);
    };
  }, []);

  const makeCall = () => {
    helloVoiceService.initiateCall();
  };

  const answerCall = () => {
    helloVoiceService.answerCall();
  };

  const endCall = () => {
    helloVoiceService.endCall();
  };

  const toggleMute = () => {
    helloVoiceService.toggleMute();
  };

  return {
    callState,
    isMuted,
    mediaStream,
    timer,
    makeCall,
    answerCall,
    endCall,
    toggleMute
  };
};