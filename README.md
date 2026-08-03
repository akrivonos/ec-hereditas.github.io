# ec-hereditas.com

Static bilingual website for NGO “Hereditas”.

## Structure

- `/` — Ukrainian home page
- `/en/` — English home page
- `/catalog/` and `/en/catalog/` — catalogue application placeholders
- `/privacy/` and `/en/privacy/` — privacy notices
- `/assets/` — shared CSS, JavaScript and logo

## Local preview

```bash
python -m http.server 8080
```

Open `http://localhost:8080/`.

## Deployment

The repository is compatible with GitHub Pages and retains the existing `CNAME` file. No build step or external JavaScript dependency is required.

## Before publication

1. Replace the registration-status placeholders after the official extract is received.
2. Add the EDRPOU code only after confirming it from the extract.
3. Publish the statute and policies only after reviewing them for personal data.
4. Connect the catalogue application at `/catalog/` while preserving both language routes.
