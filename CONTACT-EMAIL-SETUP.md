# Contact enquiry email setup

The contact form saves every enquiry on the backend, then emails enquiries@kingsvalehomes.co.uk. Replying to that notification replies directly to the visitor. Email delivery failures stay in the queue and retry automatically, with backoff up to an hour. Restarts preserve pending messages and delivery records. Only new submissions marked for email are queued; historical records are not automatically emailed.

## Google Workspace / Portainer

1. Sign into the Google account for enquiries@kingsvalehomes.co.uk. Open https://myaccount.google.com/security and enable 2-Step Verification. Then open https://myaccount.google.com/apppasswords, enter Kingsvale website as the app name and create an app password. Copy its 16 characters privately. This must be a sign-in-capable mailbox. If it is an alias, use its owning mailbox for SMTP_USER and configure the alias as an approved sending address.
2. In your Portainer stack environment, set:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=enquiries@kingsvalehomes.co.uk
SMTP_PASSWORD=<Google app password entered privately>
CONTACT_EMAIL_FROM=enquiries@kingsvalehomes.co.uk
CONTACT_EMAIL_TO=enquiries@kingsvalehomes.co.uk
```

3. In Portainer → Stacks → your Kingsvale stack → Editor, update the stack definition using docker-compose.portainer.yml from this repository. Preserve your existing port, volume and other settings. Both Compose files now explicitly pass the SMTP variables into the container. Set the variables above under Environment variables and select Update the stack / redeploy, pulling the latest image. Updating only the Docker image does not add environment mappings to an older stack definition.
4. Open Studio → Website → Contact → Website enquiry emails. Select Check email connection. It should report Email connection verified. This checks authentication without sending a test email. Authentication and network failures show different explanations.
5. Submit a contact enquiry on the public website and confirm its arrival in the inbox. A configured status confirms settings are present, not that Google has accepted them. If delivery fails, the status panel says so and the saved enquiry retries automatically.

Do not put the app password in Git, a website content field, or chat. Your ordinary Google login password will not work. If your organisation blocks app passwords, ask its Google Workspace administrator to enable an appropriate SMTP relay or provide an approved authentication method.

Official Google setup: https://support.google.com/a/answer/176600

The contact and newsletter webhooks remain optional. Newsletter signups are saved separately; this email integration sends contact enquiries only. Contact records and email delivery history are included in full backups.
