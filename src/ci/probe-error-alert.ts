import { sendErrorAlert } from "../server/services/error-alert.ts";

const webhook = process.env.ALERT_WEBHOOK_URL;
if (!webhook) {
  console.error("ALERT_WEBHOOK_URL is not set");
  process.exit(1);
}

const result = await sendErrorAlert({
  env: { ALERT_WEBHOOK_URL: webhook },
  worker: "alco-app-dev",
  kind: "probe",
  method: "PROBE",
  path: "/probe",
  errorName: "Error",
});

if (result !== "sent") {
  console.error("probe skipped");
  process.exit(1);
}

console.log("probe sent");
