/**
 * Ponto de entrada legado, para o aplicativo nativo.
 *
 * O build nativo pede `/index.bundle` ao Metro, que precisa resolver um
 * `./index` na raiz. Este projeto declara `"main": "expo-router/entry"` no
 * package.json e não tinha esse arquivo — então o Metro respondia 404 e o
 * app morria em "Unable to load script" antes de desenhar qualquer coisa.
 *
 * O caminho novo (`/.expo/.virtual-metro-entry.bundle`) continua
 * funcionando igual; este arquivo só dá ao caminho antigo o mesmo destino.
 * É o mesmo conteúdo que o `expo-router/entry` já executava.
 */
import 'expo-router/entry';
