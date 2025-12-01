// HelloVoiceService.ts
import { errorToast } from "@/components/customToast";
import { getLocalStorage } from "@/utils/utilities";
import { EventEmitter } from "events";
import WebRTC, { AnsweredPayload, CALL_EVENT, EndedPayload, ErrorPayload, MessagePayload, MutePayload, OutgoingCall, RejoinedPayload, UnmutePayload, WebRTC_EVENT } from "msg91-webrtc-call";

class HelloVoiceService {
    private static instance: HelloVoiceService | null = null;
    private webrtc: any = null;
    private eventEmitter: EventEmitter;
    private currentCall: OutgoingCall | null = null;
    private callState: string = "idle"; // idle, ringing, connected, ended
    private isMuted: boolean = false;
    private isBotCall: boolean = false;

    private constructor() {
        this.eventEmitter = new EventEmitter();
    }

    public static getInstance(): HelloVoiceService {
        if (!HelloVoiceService.instance) {
            HelloVoiceService.instance = new HelloVoiceService();
        }
        return HelloVoiceService.instance;
    }

    public initialize(): void {
        // Only initialize if not already done
        if (this.webrtc) this.webrtc.close(); this.cleanUp();

        const clientToken = getLocalStorage('HelloClientToken');
        if (!clientToken) return;

        this.webrtc = WebRTC(clientToken, 'test');
        this.webrtc.on(WebRTC_EVENT.OUTGOING_CALL, this.handleOutgoingCall);
    }

    private handleOutgoingCall = (call: OutgoingCall) => {
        const isBotCall = true;
        this.isBotCall = isBotCall;

        if (this.currentCall && isBotCall) {
            // console.log('existing call ended, hanging call')
            this.endCall();
            this.resetCall();
        }

        if (document.visibilityState === "hidden" && isBotCall) {
            call.on(CALL_EVENT.ANSWERED, (data: AnsweredPayload) => {
                // console.log('answered Not in focus end call ending call')
                call.hang();
                this.resetCall();
            });
            return;
        }

        // Only persist the call if this tab is currently active
        this.currentCall = call;
        this.callState = "ringing";
        this.eventEmitter.emit("callStateChanged", { state: this.callState });

        // Set up event listeners for this call
        call.on(CALL_EVENT.ERROR, (error: ErrorPayload) => {
            console.log("call error", error);
            errorToast(error?.message || "Something went wrong");
            this.resetCall();
        });

        call.on(CALL_EVENT.ANSWERED, (data: AnsweredPayload) => {
            this.callState = "connected";
            this.eventEmitter.emit("callStateChanged", { state: this.callState, data });
        });

        call.on(CALL_EVENT.CONNECTED, (mediaStream: MediaStream) => {
            this.callState = "connected";
            this.eventEmitter.emit("callStateChanged", {
                state: this.callState,
                mediaStream
            });
        });

        call.on(CALL_EVENT.ENDED, (data: EndedPayload) => {
            this.resetCall();
        });

        call.on(CALL_EVENT.MESSAGE, (data: MessagePayload) => {
            this.eventEmitter.emit("call-message", data);
        });

        call.on(CALL_EVENT.MUTE, ({ uid }: MutePayload) => {
            this.isMuted = true;
            this.eventEmitter.emit("muteStatusChanged", { muted: true, uid });
        });

        call.on(CALL_EVENT.UNMUTE, ({ uid }: UnmutePayload) => {
            this.isMuted = false;
            this.eventEmitter.emit("muteStatusChanged", { muted: false, uid });
        });

        call.on(CALL_EVENT.REJOINED, (data: RejoinedPayload) => {
            this.callState = "rejoined";
            this.eventEmitter.emit("callStateChanged", { state: this.callState, data });
        });

    }

    public sendMessageOnCall(
        // payload: Array<{ type: 'text' | 'image' | 'button' | 'redirect'; content?: string; options?: Array<{ title: string }> }> | string,
        payload: any,
        context: boolean = false
    ): any {
        try {
            payload?.map((item: any) => {
                if (item?.type === 'image') {
                    context = true
                    // item.content = item.content?.trim();
                } else {
                    context = false
                }
                if (this.currentCall) {
                    const response = this.currentCall?.sendMessage([item], context);
                    return response;
                } else {
                    console.warn('No active call to send message');
                    return null;
                }
            })
        } catch (e) {
            console.error('Failed to send message on call', e);
        }
    }

    public initiateCall(channelCallToken: string | null = null): void {
        if (!this.webrtc) {
            console.warn("WebRTC not initialized. Call initialize() first.");
            return;
        }
        const callToken = channelCallToken;
        if (!callToken) {
            console.warn("No call token found.");
            return;
        }

        this.webrtc.call(callToken).then(() => {
            this.callState = "ringing";
            this.eventEmitter.emit("callStateChanged", { state: this.callState });
        });
    }

    public rejoinCall(callId: string): void {
        if (!this.webrtc) {
            console.warn("WebRTC not initialized. Call initialize() first.");
            return;
        }
        this.callState = "ringing";
        this.eventEmitter.emit("callStateChanged", { state: this.callState });

        this.webrtc.rejoinCall(callId).catch((error: any) => {
            console.log('rejoin call error', error)
            this.resetCall();
        });
    }

    public endCall(): void {
        if (this.currentCall) {
            this.currentCall.hang();
        }
    }

    public toggleMute(): void {
        if (!this.currentCall) return;

        if (this.isMuted) {
            this.currentCall.unmute();
        } else {
            this.currentCall.mute();
        }
    }

    public getCallState(): string {
        return this.callState;
    }

    public getMuteStatus(): boolean {
        return this.isMuted;
    }

    public getMediaStream(): any {
        return this.currentCall ? this.currentCall.getMediaStream() : null;
    }

    public addEventListener(event: string, callback: (...args: any[]) => void): void {
        this.eventEmitter.on(event, callback);
    }

    public removeEventListener(event: string, callback: (...args: any[]) => void): void {
        this.eventEmitter.off(event, callback);
    }

    public emitEvent(event: string, data: any): void {
        this.eventEmitter.emit(event, data);
    }

    public isInitialized(): boolean {
        return !!this.webrtc;
    }

    public resetCall(): void {
        this.callState = "idle";
        this.isMuted = false;
        this.eventEmitter.emit("callStateChanged", { state: this.callState });
        this.eventEmitter.emit("muteStatusChanged", { muted: false });
        this.currentCall = null;
        this.isBotCall = false;
    }

    public cleanUp(): void {
        if (this.webrtc) {
            // this.webrtc.off("call");
            this.webrtc = null;
        }
        // this.eventEmitter.removeAllListeners();
    }

    public isBotCallConnected(): boolean {
        return this.isBotCall && this.callState === "connected";
    }
}

const helloVoiceService = HelloVoiceService.getInstance();
export default helloVoiceService;