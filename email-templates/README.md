# DuupFlow Email Templates

## How to use in Brevo

1. Go to **Contacts → Lists** and create 3 lists:
   - "Free Users" → copy the ID → set `BREVO_LIST_FREE_USERS=<id>`
   - "Active Clients" → copy the ID → set `BREVO_LIST_ACTIVE_CLIENTS=<id>`
   - "Churned" → copy the ID → set `BREVO_LIST_CHURNED=<id>`

2. Go to **Automation → Create workflow** for each list:
   - Trigger: **Contact added to list**
   - Add emails at the scheduled delays below

3. For each email: go to **Email Templates**, create a new template,
   paste the HTML from the file, save, then reference it in the automation step.

4. Variables available in Brevo templates:
   - `{{ contact.FIRSTNAME }}` → user's first name

---

## Sequences

| List | Sequence | Emails | Stop condition |
|------|----------|--------|----------------|
| Free Users | `sequence-1-free-user/` | 4 emails — D0, D2, D4, D7 | User pays (removed from list) |
| Active Clients | `sequence-2-active-client/` | 5 emails — D0, D1, D3, D5, D7 | User unsubscribes |
| Churned | `sequence-3-churned/` | 4 emails — D0, D2, D4, D7 | User resubscribes (removed from list) |
