## What is the feature?
Users can start a voice call directly from the chat widget using the call icon.

## Purpose of the feature
Helps users talk to support for issues that are easier to explain by voice.

## Basic flow
1. User clicks the call icon in the widget.
2. Voice call starts using WebRTC.
3. Call UI shows current call state.

## Entry point
- UI Component: CallButton.tsx
- Service: HelloVoiceService.ts
- Hook: useCallUI.ts

## Dependencies & libraries
- msg91-webrtc-call – WebRTC voice calling

## Code-level flow
- CallButton.tsx triggers the call start.
- HelloVoiceService.ts manages the call lifecycle and state.
- useCallUI.ts exposes call state to UI components.
- CallUI.tsx renders the call interface based on state. 