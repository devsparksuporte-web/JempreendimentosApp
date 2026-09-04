import * as ImagePicker from 'expo-image-picker';

import { garantirPermissao } from '@/lib/permissoes';
import { supabase } from '@/lib/supabase';

/**
 * Foto de perfil.
 *
 * O arquivo vai para `avatars/<id do perfil>/perfil.jpg`, sempre esse nome.
 * Duas consequências boas: a política do balde compara a primeira pasta com
 * o dono da sessão — ninguém troca a foto de ninguém — e trocar a foto
 * substitui a anterior em vez de acumular lixo a cada tentativa.
 *
 * Como o caminho não muda, o navegador guardaria a imagem antiga em cache.
 * Por isso a URL gravada leva `?v=<momento>`: mesmo arquivo, endereço novo.
 */

const BALDE = 'avatars';

/** De onde tirar a foto. Câmera para quem está em campo, galeria para o resto. */
export type OrigemDaFoto = 'camera' | 'galeria';

async function escolherImagem(origem: OrigemDaFoto) {
  if (origem === 'camera') {
    const permissao = await garantirPermissao('camera');
    if (!permissao.ok) throw new Error(permissao.mensagem ?? 'Permissão de câmera necessária.');
    return ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
  }

  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) throw new Error('Permissão para acessar as fotos é necessária.');
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.6,
  });
}

/**
 * Escolhe, envia e grava a foto no perfil.
 *
 * Devolve a URL nova, ou `null` se a pessoa desistiu no seletor — desistir
 * não é erro e não deve virar mensagem vermelha na tela.
 */
export async function trocarFotoDePerfil(origem: OrigemDaFoto): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  const eu = auth.user?.id;
  if (!eu) throw new Error('Sessão expirada. Entre de novo.');

  const resultado = await escolherImagem(origem);
  if (resultado.canceled || !resultado.assets?.[0]) return null;

  const asset = resultado.assets[0];
  const corpo = await fetch(asset.uri).then((r) => r.arrayBuffer());
  const caminho = `${eu}/perfil.jpg`;

  const { error: falhaEnvio } = await supabase.storage.from(BALDE).upload(caminho, corpo, {
    contentType: asset.mimeType ?? 'image/jpeg',
    upsert: true,
  });
  if (falhaEnvio) throw new Error(falhaEnvio.message);

  const publica = supabase.storage.from(BALDE).getPublicUrl(caminho).data.publicUrl;
  const url = `${publica}?v=${Date.now()}`;

  const { error: falhaPerfil } = await (supabase as any)
    .from('profiles')
    .update({ avatar_url: url, updated_at: new Date().toISOString() })
    .eq('id', eu);
  if (falhaPerfil) throw new Error(falhaPerfil.message);

  return url;
}

/**
 * Tira a foto do perfil.
 *
 * Apaga o arquivo também: deixar a imagem no balde depois de removida do
 * perfil seria manter no ar, em endereço público, um rosto que a pessoa
 * pediu para tirar.
 */
export async function removerFotoDePerfil(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const eu = auth.user?.id;
  if (!eu) throw new Error('Sessão expirada. Entre de novo.');

  const { error } = await (supabase as any)
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', eu);
  if (error) throw new Error(error.message);

  await supabase.storage.from(BALDE).remove([`${eu}/perfil.jpg`]);
}

/**
 * Endereço da foto de alguém, ou um boneco gerado a partir do nome.
 *
 * O boneco não é enfeite: numa lista de técnicos, um espaço vazio no lugar
 * do rosto parece falha de carregamento. Melhor um desenho estável, sempre
 * o mesmo para a mesma pessoa.
 */
export function fotoOuBoneco(avatarUrl: string | null | undefined, nome: string): string {
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(nome)}`;
}

/**
 * Atualiza os dados que a própria pessoa mantém.
 *
 * Email fica de fora de propósito: trocá-lo no Supabase dispara confirmação
 * nos dois endereços, e uma falha no meio do caminho deixa alguém sem
 * acesso. Isso merece fluxo próprio, com aviso — não um campo no meio de
 * outros dois.
 *
 * O WhatsApp acompanha o telefone quando ainda não foi preenchido: na
 * prática é o mesmo número, e pedir duas vezes a mesma coisa é o tipo de
 * atrito que faz a pessoa desistir de completar o cadastro.
 */
export async function atualizarPerfil(dados: {
  nome: string;
  telefone: string | null;
}): Promise<void> {
  const nome = dados.nome.trim();
  if (nome.length < 2) throw new Error('Informe o nome completo.');

  const telefone = dados.telefone?.replace(/\D/g, '') || null;
  if (telefone && telefone.length < 10) {
    throw new Error('Telefone incompleto. Use DDD e número.');
  }

  const { data: auth } = await supabase.auth.getUser();
  const eu = auth.user?.id;
  if (!eu) throw new Error('Sessão expirada. Entre de novo.');

  const { data: atualPerfil } = await (supabase as any)
    .from('profiles')
    .select('whatsapp')
    .eq('id', eu)
    .single();

  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      full_name: nome,
      phone: telefone,
      whatsapp: (atualPerfil?.whatsapp as string | null) ?? telefone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', eu);
  if (error) throw new Error(error.message);
}

/** Telefone no formato (31) 99999-9999, para exibir. */
export function telefoneBonito(valor: string | null | undefined): string {
  const d = (valor ?? '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return valor || '';
}
