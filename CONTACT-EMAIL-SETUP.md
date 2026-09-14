# Contact enquiry email setup

The contact form saves every enquiry on the backend, then emails enquiries@kingsvalehomes.co.uk. Replying to that notification replies directly to the visitor. Email delivery failures stay in the queue and retry automatically, with backoff up to an hour. Restarts preserve pending messages and delivery records. Only new submissions marked for email are queued; historical records are not automatically emailed.

## Google Workspace / Portainer

1. Enable 2-Step Verification for enquiries@kingsvalehomes.co.uk and generate a Google app password for this website. This must be a sign-in-capable mailbox. If it is an alias, use its owning mailbox for SMTP_USER and configure the alias as an approved sending address.
2. In your Portainer stack environment, set:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=enquiries@kingsvalehomes.co.uk
SMTP_PASSWORD=<Google app password entered privately>
CONTACT_EMAIL_FROM=enquiries@kingsvalehomes.co.uk
CONTACT_EMAIL_TO=enquiries@kingsvalehomes.co.uk
```

3. Redeploy the updated stack, retaining the existing data volume. docker-compose.yml passes these variables into the container. When using an image-only stack, add the same environment mappings to that stack.
4. Open Studio → Website → Contact → Website enquiry emails. Refresh the status: it should say email delivery is configured.
5. Submit a contact enquiry on the public website and confirm its arrival in the inbox. A configured status confirms settings are present, not that Google has accepted them. If delivery fails, the status panel says so and the saved enquiry retries automatically.

Do not put the app password in Git, a website content field, or chat. Your ordinary Google login password will not work. If your organisation blocks app passwords, ask its Google Workspace administrator to enable an appropriate SMTP relay or provide an approved authentication method.

Official Google setup: https://support.google.com/a/answer/176600

The contact and newsletter webhooks remain optional. Newsletter signups are saved separately; this email integration sends contact enquiries only. Contact records and email delivery history are included in full backups.
