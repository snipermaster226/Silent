import { findByProps } from "@vendetta/metro";
import { storage } from "@vendetta/plugin";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function silentDeleteMessage(
    channelId: string,
    messageId: string
): Promise<boolean> {
    const RestAPI = findByProps("get", "post", "del", "patch");

    try {
        const replacementText: string = storage.replacementText ?? "** **";
        const deleteDelay: number = storage.deleteDelay ?? 200;
        const suppressNotifications: boolean = storage.suppressNotifications ?? true;
        const shouldDelete: boolean = storage.deleteOriginal ?? true;

        // Post a replacement message
        const response = await RestAPI.post({
            url: `/channels/${channelId}/messages`,
            body: {
                content: replacementText,
                flags: suppressNotifications ? 4096 : 0,
                mobile_network_type: "unknown",
                nonce: messageId,
                tts: false,
            },
        });

        // Delete the replacement
        await sleep(deleteDelay);
        await RestAPI.del({
            url: `/channels/${channelId}/messages/${response.body.id}`,
        });

        // Delete the original
        if (shouldDelete) {
            await sleep(100);
            await RestAPI.del({
                url: `/channels/${channelId}/messages/${messageId}`,
            });
        }

        return true;
    } catch (err) {
        console.error("[SilentDelete] Error:", err);
        return false;
    }
}
