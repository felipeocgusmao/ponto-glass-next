# PontoGlass — Extensão Chrome (protótipo)

Popup que mostra a tela de **batida de ponto** direto do navegador e, para
**admin/gerente**, um painel rápido (correções pendentes + quem está trabalhando
agora). Reaproveita a sessão já logada no site — não há login separado.

## Como funciona

- A extensão chama as **mesmas APIs** do app web (`/api/me`, `/api/records`,
  `/api/punch`, `/api/correction-requests`).
- A autenticação usa o **cookie de sessão** (`ponto_token`, httpOnly) que o
  Chrome anexa automaticamente porque a extensão declara `host_permissions`
  para o domínio do app. Para hosts com permissão, o Chrome trata as requisições
  como first-party, então o cookie `SameSite=Lax` é enviado normalmente.
- A UI muda conforme o **nível** retornado por `/api/me`:
  - **Funcionário** → painel de ponto (estado, botões contextuais, anel de
    jornada, horas trabalhadas/extras, ganhos do dia, histórico de hoje).
  - **Admin / Gerente** → tudo acima + seção **Painel**: nº de correções
    pendentes e lista de quem está trabalhando agora, com atalho ao painel
    completo.

## Instalar (modo desenvolvedor)

1. Abra `chrome://extensions`.
2. Ative o **Modo do desenvolvedor** (canto superior direito).
3. Clique em **Carregar sem compactação** e selecione esta pasta `extension/`.
4. Faça login normalmente em https://ponto-glass-next.vercel.app .
5. Clique no ícone da extensão (o relógio) — o popup abre já autenticado.

## Configuração

Edite `config.js`:

- `baseUrl` — domínio do deployment. Se mudar, atualize **também** o
  `host_permissions` em `manifest.json` (a extensão só envia o cookie para
  hosts com permissão).
- `businessTz` — deve bater com `NEXT_PUBLIC_BUSINESS_TZ` no servidor para o
  cálculo de "hoje" e dos minutos trabalhados ficar idêntico ao site.

## Limitações conhecidas (protótipo)

- **Geolocalização**: capturada com `navigator.geolocation` no popup, com
  timeout de 8s e em modo best-effort. Se `geo_mode = 'required'` e o GPS não
  responder a tempo, a batida é bloqueada com aviso (mesma regra do servidor).
- A lógica de minutos/estado em `lib/punch-utils.js` é **portada** de
  `lib/utils.ts`. Se a fórmula no app mudar, sincronize este arquivo.
- Sem build step: é JS puro com ES modules, carregável direto como unpacked.

## Estrutura

```
extension/
├── manifest.json        # MV3, host_permissions, popup, ícones
├── config.js            # baseUrl + businessTz
├── popup.html           # markup do popup
├── popup.css            # tema escuro espelhando o app
├── popup.js             # lógica: fetch das APIs, render por nível, batida
├── lib/punch-utils.js   # math portado de lib/utils.ts
└── icons/               # ícone do relógio (16/32/48/128)
```
