# Publicação na Chrome Web Store

Materiais e passos para publicar a extensão PontoGlass.

## Empacotar

```bash
cd extension
./package.sh
# → dist/pontoglass-extension-v<versão>.zip
```

Faça upload desse zip no [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
(requer conta de programador Google, taxa única de US$5).

## Passos no Developer Dashboard

1. **Novo item** → enviar o `.zip`.
2. Preencher a **listagem** (textos abaixo).
3. Anexar **imagens**: ícone 128×128 (já incluído) + ao menos 1 screenshot 1280×800 ou 640×400 do popup. _(Capturar manualmente — não versionado.)_
4. **Privacidade**: declarar uso de dados e colar a política abaixo (ou hospedar e linkar).
5. **Justificar permissões** (texto abaixo).
6. Enviar para revisão.

## Listagem

**Nome:** PontoGlass — Ponto rápido

**Resumo (132 caracteres):**
> Bata o ponto e veja o resumo do dia direto do navegador. Reaproveita a sessão já logada no PontoGlass.

**Descrição:**
> Registe entrada, saída, almoço e pausas sem sair da aba atual. O popup mostra o relógio ao vivo, o anel de jornada, horas trabalhadas/extras e o histórico do dia. Administradores e gerentes ganham um painel rápido com correções pendentes e quem está a trabalhar agora.
>
> A extensão reutiliza a sua sessão já iniciada no PontoGlass — não há login separado. Funciona apenas com a sua própria conta e a sua empresa.

**Categoria:** Produtividade · **Idioma:** Português

## Justificativa de permissões

- **`host_permissions` (`https://ponto-glass-next.vercel.app/*`)** — fazer as chamadas autenticadas à API do PontoGlass reaproveitando o cookie de sessão; sem isto a extensão não consegue ler o ponto nem registar batidas.
- **`geolocation`** — anexar a localização à batida quando a empresa exige/permite geofencing (mesma regra do app).
- **`offscreen`** — obter a localização de forma fiável a partir do service worker (a API de geolocalização não existe no service worker; o documento offscreen é o meio suportado no Manifest V3).

## Política de privacidade (modelo)

> A extensão PontoGlass não coleta, armazena nem partilha dados pessoais com terceiros. Toda a comunicação ocorre diretamente entre o seu navegador e o servidor do PontoGlass da sua organização, usando a sessão já autenticada. A localização, quando solicitada, é enviada apenas ao servidor do PontoGlass no momento da batida, conforme a política de geofencing da empresa, e nunca é guardada pela extensão.

Hospede este texto numa URL pública e informe-a no campo "Política de privacidade" do dashboard.
