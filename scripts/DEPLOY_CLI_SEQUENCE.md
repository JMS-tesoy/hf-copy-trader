# CLI Deploy Sequence (Agent-Safe)

Use this exact sequence when deploying from terminal to avoid targeting the wrong Vercel project.

## Preconditions

- Repo root: `d:\Documents\Website Project\copy-trading-platform`
- Vercel project: `frontend`
- Cloud Root Directory setting: `frontend`

## 1) Go to repo root

```powershell
cd "d:\Documents\Website Project\copy-trading-platform"
```

## 2) Clear proxy env vars in current shell

```powershell
$env:HTTP_PROXY=''
$env:HTTPS_PROXY=''
$env:ALL_PROXY=''
```

## 3) Verify Vercel auth

```powershell
vercel whoami
```

If invalid, run:

```powershell
vercel login
```

## 4) Link local repo to the correct project

```powershell
vercel link --project frontend --yes
```

## 5) Verify root directory setting

```powershell
vercel project inspect frontend
```

Expected:

```text
Root Directory        frontend
```

## 6) Deploy production

```powershell
vercel --prod --yes
```

## 7) Verify latest deployment belongs to correct project

```powershell
vercel ls --yes
```

Confirm latest deploy is under:

```text
fxjoel237-5946s-projects/frontend
```

## 8) Optional smoke check

```powershell
curl.exe -s -o - -w "`nHTTP:%{http_code}`n" https://frontend-nine-theta-86.vercel.app/landing
```
