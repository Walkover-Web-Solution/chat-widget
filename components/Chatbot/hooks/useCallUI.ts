// useCallUI.ts
import { setDataInAppInfoReducer } from '@/store/appInfo/appInfoSlice';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import helloVoiceService from './HelloVoiceService';

export const useCallUI = () => {
  const [callState, setCallState] = useState<"idle" | "ringing" | "connected" | "ended" | "rejoined">("idle");
  const [callDirection, setCallDirection] = useState<"incoming" | "outgoing" | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [mediaStream, setMediaStream] = useState<any>({ key: null, mediaStream: null });
  const [rejoinSummary, setRejoinSummary] = useState<any>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    // Set initial state
    setCallState(helloVoiceService.getCallState() as "idle" | "ringing" | "connected" | "ended" | "rejoined");
    setCallDirection(helloVoiceService.getCallDirection());
    setCallId(helloVoiceService.getCallId());
    setIsMuted(helloVoiceService.getMuteStatus());

    // Set up event listeners
    const handleCallStateChange = ({ state, mediaStream, data, direction, callId: nextCallId }: any) => {
      setCallState(state);
      if (direction !== undefined) setCallDirection(direction);
      if (nextCallId !== undefined) setCallId(nextCallId);
      if (data?.id) setCallId(data.id);
      if (mediaStream) {
        setMediaStream({ key: Date.now(), mediaStream: mediaStream });
      }
      if (state === 'connected' && data?.id) {
        dispatch(setDataInAppInfoReducer({ callToken: data?.id }))
      } else if (state === 'idle') {
        dispatch(setDataInAppInfoReducer({ callToken: '' }))
        setRejoinSummary(null)
      } else if (state === 'rejoined') {
        setRejoinSummary(data?.summary)
      }
    };

    const handleMuteChange = ({ muted }: any) => {
      setIsMuted(muted);
    };

    helloVoiceService.addEventListener("callStateChanged", handleCallStateChange);
    helloVoiceService.addEventListener("muteStatusChanged", handleMuteChange);

    // Clean up event listeners
    return () => {
      helloVoiceService.removeEventListener("callStateChanged", handleCallStateChange);
      helloVoiceService.removeEventListener("muteStatusChanged", handleMuteChange);
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

  const rejectCall = () => {
    helloVoiceService.rejectCall();
  };

  return {
    callState,
    callDirection,
    callId,
    isMuted,
    mediaStream,
    makeCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    rejoinSummary
  };
};