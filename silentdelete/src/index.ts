import { findByProps } from "@vendetta/metro";
import { before } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";
import { logger } from "@vendetta";
import Settings from "./settings";
import { loadCommands, unloadCommands } from "./commands";
import { silentDeleteMessage } from "./utils";

// ─── Module lookups ────────────────────────────────────────────────────────────
const MessageStore = findByProps("getMessage", "getMessages");
const UserStore = findByProps("getCurrentUser", "getUser");

// ─── State ─────────────────────────────────────────────────────────────────────
let patches: Array<() => void> = [];

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Adds a "Silent Delete" button to the message long-press action sheet.
 * Revenge uses a before-patch on the action-sheet builder rather than a
 * dedicated MessagePopover API, so we patch `showSimpleActionSheet` /
 * `buildMessageContextMenu` depending on what is available.
 */
function patchMessageActionSheet() {
    // Try to find the action-sheet utilities used by Revenge builds
    const ActionSheetUtils =
        findByProps("showMessageOptionsSheet") ??
        findByProps("showSimpleActionSheet");

    if (!ActionSheetUtils) {
        logger.warn("[SilentDelete] Could not find action-sheet module – button patch skipped.");
        return;
    }

    // The method name differs between client versions; pick whichever exists
    const methodName = ActionSheetUtils.showMessageOptionsSheet
        ? "showMessageOptionsSheet"
        : "showSimpleActionSheet";

    const unpatch = before(methodName, ActionSheetUtils, (args: any[]) => {
        // args[0] is usually the options object that contains the `options` array
        const opts: any = args[0];
        if (!opts || !opts.options) return;

        const currentUserId: string = UserStore.getCurrentUser()?.id;
        const message = opts.message ?? opts.options?.[0]?.message;
        if (!message) return;

        // Only show the button on our own, non-deleted messages
        if (message.author?.id !== currentUserId || message.deleted) return;

        opts.options.push({
            label: "Silent Delete",
            // "destructive" colours the row red on iOS / highlights on Android
            isDestructive: true,
            action: () =>
                silentDeleteMessage(message.channel_id, message.id),
        });
    });

    patches.push(unpatch);
    logger.log("[SilentDelete] Action-sheet patched.");
}

// ─── Plugin lifecycle ──────────────────────────────────────────────────────────
export default {
    onLoad() {
        // Initialise persisted settings with sensible defaults
        storage.replacementText ??= "** **";
        storage.deleteDelay ??= 200;
        storage.suppressNotifications ??= true;
        storage.deleteOriginal ??= true;
        storage.purgeInterval ??= 500;

        patchMessageActionSheet();
        loadCommands();

        logger.log("[SilentDelete] Loaded.");
    },

    onUnload() {
        for (const unpatch of patches) unpatch();
        patches = [];
        unloadCommands();
        logger.log("[SilentDelete] Unloaded.");
    },

    settings: Settings,
};
