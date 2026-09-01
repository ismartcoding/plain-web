# Successful browser SMS remains stuck on “Sending…” on Android 17

## Tracking

- Issue: https://github.com/plainhub/plain-app/issues/345
- Repositories: https://github.com/plainhub/plain-app and https://github.com/plainhub/plain-desktop
- Branch/commit tested: `plain-app` `4ae019ba` (`v3.3.16`, current upstream); `plain-desktop` `d3b1ff1e` (current upstream)
- Pull request: to be added after creation

## Priority and scope

This is a high-priority SMS correctness bug because the browser reports an in-progress send indefinitely even after Android confirms that the carrier send succeeded. It affects the browser UI and the shared Tauri desktop frontend when the Android host applies Android 17's restricted-message behavior to SMS sent by a non-default messaging app.

The correction is intentionally limited to truthful terminal status for a correlated browser send while retaining the optimistic item for later provider reconciliation. It does not bypass Android's restricted-message access control, make PlainApp the default SMS application, or attempt to replace Android's system SMS database.

## Reported behavior

After upgrading the Android app to PlainApp 3.3.16, an SMS sent from an open browser conversation remains labeled “Sending…” forever. Waiting and switching threads do not settle the status.

## Reproduction

### Environment

- Android host: PlainApp 3.3.16, which is current upstream commit `4ae019ba`
- Device: Pixel 9 Pro running GrapheneOS on Android 17 / API 37
- Browser: Chrome 151 using the PlainApp web client bundled with 3.3.16
- Permissions: PlainApp's read-SMS and send-SMS access enabled and granted
- Default SMS application: a separate native messaging application; PlainApp is not the default SMS application

### Steps

1. Open an existing SMS conversation in the PlainApp browser client.
2. Send an SMS to an authorized test destination.
3. Observe the optimistic outgoing bubble.
4. Wait for the Android sent callback and the browser's provider reconciliation retries.

### Actual result

- The GraphQL `sendSms` mutation returns `true` without errors.
- The browser receives a correlated `SMS_SEND_RESULT` WebSocket event with `success=true` and Android's successful result code.
- Android persists a sent SMS row with successful provider status/error fields.
- PlainApp's GraphQL SMS query cannot return that row.
- The optimistic bubble remains and continues to display “Sending…” after every retry and after the normal five-minute deadline would have elapsed.

### Expected result

Once the correlated Android sent callback reports success, the outgoing bubble should display “Sent”. It should remain eligible for replacement by the authoritative provider row if that row later becomes readable.

## Investigation findings

### The carrier send succeeds

The failure is not a GraphQL timeout, WebSocket disconnect, missing Android permission, SIM selection failure, or carrier failure. The mutation succeeds, Android invokes PlainApp's sent `PendingIntent`, the result tracker publishes a correlated successful terminal event, and the system SMS provider contains the sent row.

### Android 17 hides the persisted row from PlainApp

Safe provider metadata comparison showed that ordinary incoming messages and messages sent by the default SMS application have `restricted=0`. Every controlled message sent by PlainApp has:

- `type=2` (sent)
- successful provider status/error values
- `creator=com.ismartcoding.plain`
- `restricted=1`

Android 17's message-promotion implementation marks messages inserted for a non-default SMS package as read-restricted by default. A restricted row is filtered from provider queries unless the caller has the privileged `READ_RESTRICTED_MESSAGES` app-op. PlainApp does not have that app-op and should not attempt to bypass this platform boundary.

The platform path is explicit in the Android 17 sources: the SMS provider applies `ReadRestriction.setReadRestrictionValueOnInsert()` during insertion, `Telephony.ReadRestriction` defaults the row to restricted when message promotion is enabled and the caller is not the default SMS package, and provider queries filter restricted rows unless the read-restricted-message app-op is allowed. See [GrapheneOS `SmsProvider`](https://github.com/GrapheneOS/platform_packages_providers_TelephonyProvider/blob/17/src/com/android/providers/telephony/SmsProvider.java), [`Telephony.ReadRestriction`](https://github.com/GrapheneOS/platform_frameworks_base/blob/17/core/java/android/provider/Telephony.java), and [`ProviderUtil.canReadRestrictedMessages`](https://github.com/GrapheneOS/platform_packages_providers_TelephonyProvider/blob/17/src/com/android/providers/telephony/ProviderUtil.java).

The access-control diagnosis was verified reversibly: the same exact-ID GraphQL query returned no row with PlainApp's normal app-op state, returned the sent row while `READ_RESTRICTED_MESSAGES` was temporarily allowed through ADB, and returned no row again after the original ignored state was restored.

### Provider reconciliation would otherwise match

The original optimistic item and Android provider row were compared without exposing message content or destination data. Their thread, body, normalized destination, direction, and timestamp window all match. The row is absent only because the Android provider filters it before PlainApp's query receives results.

### A successful terminal result is still rendered as pending

`useMessageThread.handleSmsSendResult()` settles the failure deadline and starts three forced provider retries when a successful result arrives. If no readable provider row appears, the optimistic item remains in `pendingSmsItems`.

`MessageChatBubble.vue` determines the visible state entirely from the `pending_sms` ID prefix. There is no successful-but-awaiting-reconciliation state, so an item whose send is conclusively successful is still rendered as “Sending…”. The successful result also cancels the only deadline that could remove or fail it, making the label permanent for the lifetime of that page state.

## Root cause

The bug is the interaction of two valid behaviors and one invalid frontend assumption:

1. Android 17 read-restricts SMS rows created for a non-default messaging app while the platform's message-promotion flow is unresolved.
2. PlainApp correctly lacks privileged access to read those restricted rows.
3. The frontend assumes every successful sent callback will soon be followed by a queryable provider row and has no terminal “Sent, awaiting provider reconciliation” state.

When assumption 3 is false, a successful send remains visually in progress forever.

## Implemented correction

The correction is confined to `plain-desktop`, which is the shared browser/Tauri frontend:

1. Pending SMS operations now carry an explicit client-only `sending` or `sent` state.
2. A correlated successful `SMS_SEND_RESULT` transitions only its matching operation to `sent` while retaining the optimistic item for provider reconciliation.
3. Duplicate successful terminal results are ignored after the first state transition.
4. Deadline startup reads the same pending-operation state, replacing the separate success set and preserving the result-before-mutation-response race protection.
5. `MessageChatBubble` renders “Sent” for a successful optimistic SMS instead of deriving “Sending…” solely from its temporary ID.
6. Existing provider matching remains unchanged: if Android later exposes the authoritative sent row, reconciliation removes the optimistic copy normally.

## Regression coverage

- `tests/lib/sms-state-sync.test.ts`
  - proves a correlated success retains the optimistic item and marks it sent;
  - proves a later matching provider row still reconciles it;
  - proves a duplicate successful terminal result is idempotent.
- `tests/hooks/message-thread.test.ts`
  - proves a success that arrives before mutation acceptance prevents a false deadline;
  - proves three unsuccessful provider retries leave the successful operation present and marked sent, without draft restoration or failure notification.

## Validation

### Before-fix evidence completed

- Reproduced on current upstream / official 3.3.16.
- Confirmed successful GraphQL mutation and correlated WebSocket terminal result.
- Confirmed successful sent row in the Android provider.
- Confirmed the row is excluded from PlainApp GraphQL under the normal app-op state.
- Confirmed that temporarily allowing restricted-message reads makes the same row queryable, then restored the original app-op state.
- Confirmed the optimistic and provider records would reconcile if the row were visible.

### Post-fix validation

- `corepack yarn test tests/lib/sms-state-sync.test.ts tests/hooks/message-thread.test.ts`: 20/20 tests passed.
- `corepack yarn typecheck`: passed.
- ESLint over every changed TypeScript/Vue/test file: passed.
- `corepack yarn build`: production Vite build passed.
- `corepack yarn test`: 483 passed and 52 skipped. Four pre-existing environment/isolation tests failed in unchanged `cross-window-store`, `local-mode`, and `window-client` suites; these are the same unrelated baseline failures already recorded in the main issue #345 report.
- Real browser/device proof used the built production assets in an isolated Chrome tab against the official 3.3.16 Android backend. One authorized carrier SMS was sent from the conversation composer. The browser displayed “Sent” on the correlated bubble and still displayed “Sent” after all provider retries. The recipient confirmed receipt, while safe Android metadata confirmed that the persisted sent row was again `restricted=1` with successful provider status/error values.
- PlainApp's `READ_RESTRICTED_MESSAGES` app-op was restored to its original ignored state after diagnosis and again verified after the test.

## Remaining limitations

Android controls whether and when a restricted provider row becomes readable to PlainApp. The frontend can truthfully display the successful terminal result and retain it for later reconciliation, but it must not grant itself privileged provider access. A full page reload cannot reconstruct a provider-filtered message unless the platform/default messaging app has promoted the row or PlainApp introduces a separate durable message store; that broader storage and privacy decision is outside this focused status fix.
