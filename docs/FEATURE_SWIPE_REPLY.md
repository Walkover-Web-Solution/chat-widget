## What is the feature?
Users can reply to a specific message inside the chat widget.

## Purpose of the feature
Helps users respond with context by linking their message to a previous message.

## Basic flow
- User clicks the reply option on a message.
- Reply preview appears above the input field.
- User types and sends the reply.
- Reply state is cleared after sending.

## Entry point
- UI Component: HumanOrBotMessage.tsx
- Context: ReplyContext.tsx
- UI Preview: ReplyPreview.tsx
- Input Component: ChatbotTextField.tsx

## Code-level flow
- HumanOrBotMessage.tsx sets the message to reply.
- ReplyContext.tsx stores and manages reply state.
- ReplyPreview.tsx shows the selected reply message.
- ChatbotTextField.tsx sends the reply and clears state.