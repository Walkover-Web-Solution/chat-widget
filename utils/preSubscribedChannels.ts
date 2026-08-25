/**
 * Channels subscribed to before their first message was sent, so the history effect
 * can skip a fetch that would only overwrite a reply the socket already delivered.
 */
const preSubscribedChannels = new Set<string>();

/** Record that `channelId` had a live subscription before its first message was sent. */
export const markPreSubscribed = (channelId?: string): void => {
  if (channelId) preSubscribedChannels.add(channelId);
};

/** Report whether `channelId` was pre-subscribed, clearing it so it suppresses one fetch only. */
export const consumePreSubscribed = (channelId?: string): boolean => {
  if (!channelId) return false;
  return preSubscribedChannels.delete(channelId);
};
