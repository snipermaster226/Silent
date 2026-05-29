import { registerCommand, unregisterAllCommands } from "@vendetta/commands";
import { findByProps } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { storage } from "@vendetta/plugin";
import { silentDeleteMessage, sleep } from "./utils";

const MessageStore = findByProps("getMessages");

export const loadCommands = () => {
    registerCommand({
        name: "silentpurge",
        description: "Silently delete your recent messages in this channel",
        options: [
            {
                name: "count",
                description: "Number of your recent messages to silently delete (1–100)",
                type: 4 /* INTEGER */,
                required: true,
            },
        ],
        execute: async (args, ctx) => {
            const countArg = args?.find((o: any) => o.name === "count");
            const count = parseInt(countArg?.value);
            if (!count || count < 1 || count > 100) {
                showToast("Please provide a count between 1 and 100.", getAssetIDByName("failure-header"));
                return;
            }

            const channelId: string = ctx?.channel?.id;
            if (!channelId) return;

            // findByProps to get the REST API and user store
            const RestAPI = findByProps("get", "post", "del", "patch");
            const UserStore = findByProps("getCurrentUser");
            const currentUserId: string = UserStore.getCurrentUser().id;

            try {
                const userMessages: any[] = [];
                let lastMessageId: string | undefined;

                while (userMessages.length < count) {
                    const query: Record<string, any> = { limit: "100" };
                    if (lastMessageId) query.before = lastMessageId;

                    const response = await RestAPI.get({
                        url: `/channels/${channelId}/messages`,
                        query,
                    });

                    const messages: any[] = response?.body ?? [];
                    if (!messages.length) break;

                    for (const msg of messages) {
                        if (msg.author?.id === currentUserId) {
                            userMessages.push(msg);
                            if (userMessages.length >= count) break;
                        }
                    }

                    lastMessageId = messages[messages.length - 1]?.id;
                    if (messages.length < 100) break;
                    await sleep(100);
                }

                if (!userMessages.length) {
                    showToast("No messages found to delete.", getAssetIDByName("failure-header"));
                    return;
                }

                const purgeInterval: number = storage.purgeInterval ?? 500;
                let successCount = 0;

                for (let i = 0; i < userMessages.length; i++) {
                    if (await silentDeleteMessage(channelId, userMessages[i].id)) {
                        successCount++;
                    }
                    if (i < userMessages.length - 1) await sleep(purgeInterval);
                }

                showToast(
                    `Successfully silently deleted ${successCount} message(s).`,
                    getAssetIDByName("check")
                );
            } catch (err) {
                console.error("[SilentDelete] silentpurge error:", err);
                showToast("An error occurred during purge.", getAssetIDByName("failure-header"));
            }
        },
    });
};

export const unloadCommands = () => unregisterAllCommands();
