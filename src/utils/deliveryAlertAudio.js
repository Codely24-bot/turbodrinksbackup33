let sharedAudio = null;

const getSharedAudio = () => {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio('/ifood-alert.mp3');
    sharedAudio.preload = 'auto';
  }
  return sharedAudio;
};

export const unlockDeliveryAlertAudio = async () => {
  const audio = getSharedAudio();
  if (!audio) return false;

  try {
    audio.muted = true;
    audio.volume = 0;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    audio.volume = 1;
    return true;
  } catch (error) {
    console.error('Erro ao liberar áudio do delivery:', error);
    return false;
  }
};

export const playDeliveryAlertSnippet = async (seconds = 3.2) => {
  const audio = getSharedAudio();
  if (!audio) return false;

  try {
    audio.pause();
    audio.currentTime = 0;
    await audio.play();
    window.setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, seconds * 1000);
    return true;
  } catch (error) {
    console.error('Erro ao tocar áudio do delivery:', error);
    return false;
  }
};

export const stopDeliveryAlertAudio = () => {
  const audio = getSharedAudio();
  if (!audio) return;
  audio.pause();
  audio.currentTime = 0;
};
