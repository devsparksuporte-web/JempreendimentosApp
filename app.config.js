/**
 * Config dinâmica do Expo.
 *
 * Existe para registrar o plugin do Mapbox sem colocar segredo em arquivo.
 *
 * O SDK Android do Mapbox mora num Maven privado, então o Gradle precisa de um
 * token de download (`sk.…` com escopo DOWNLOADS:READ) em tempo de BUILD. Ele
 * é lido da variável de ambiente RNMAPBOX_MAPS_DOWNLOAD_TOKEN pelo próprio
 * plugin — passar via opção `RNMapboxMapsDownloadToken` está depreciado e
 * ainda gravaria o segredo em android/gradle.properties.
 *
 * Onde definir:
 *   - local ....... no .env (que está no .gitignore)
 *   - EAS ......... eas env:create --name RNMAPBOX_MAPS_DOWNLOAD_TOKEN \
 *                     --scope project --visibility secret
 *
 * O token PÚBLICO (`pk.…`), usado em execução para carregar os tiles, é outro
 * e vai em EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.
 */

const base = require('./app.json');

module.exports = () => {
  const expo = { ...base.expo };

  expo.plugins = [...(expo.plugins ?? []), '@rnmapbox/maps'];

  return { expo };
};
