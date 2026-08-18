/**
 * Config dinâmica do Expo.
 *
 * Existe por um motivo só: o `@rnmapbox/maps` precisa do token de download do
 * Mapbox em tempo de build, e esse token é SECRETO (`sk.…`). Ele não pode
 * ficar no app.json, que vai para o git — então entra por variável de
 * ambiente.
 *
 * Onde definir MAPBOX_DOWNLOAD_TOKEN:
 *   - build local .......... no arquivo .env (que está no .gitignore)
 *   - build no EAS ......... `eas env:create --name MAPBOX_DOWNLOAD_TOKEN --scope project --visibility secret`
 *
 * O token PÚBLICO (`pk.…`), usado em execução para carregar os tiles, é outro:
 * vai em EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.
 */

const base = require('./app.json');

const downloadToken = process.env.MAPBOX_DOWNLOAD_TOKEN;

module.exports = () => {
  const expo = { ...base.expo };

  expo.plugins = [
    ...(expo.plugins ?? []),
    ['@rnmapbox/maps', downloadToken ? { RNMapboxMapsDownloadToken: downloadToken } : {}],
  ];

  return { expo };
};
