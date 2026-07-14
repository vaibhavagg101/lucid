import { createContext } from 'react';

export interface NewAudioContextType {
    originalAudioId: string | null;
    changeOriginalAudioId: (path: string) => void;
    fileExt: string | null;
    changeFileExt: (fileExt: string | null) => void;
    fileType: string | null;
    changeFileType: (fileType: string | null) => void;
    originalAudioBlob: Blob | null;
    changeOriginalAudioBlob: (file: Blob) => void;
    error: string | null;
    changeError: (message: string | null) => void;
    currentPath: string;
    changeCurrentPath: (path: string) => void;
}

export const NewAudioContext = createContext<NewAudioContextType>({
    originalAudioId: null,
    changeOriginalAudioId: () => { },
    fileExt: null,
    changeFileExt: () => { },
    fileType: null,
    changeFileType: () => { },
    originalAudioBlob: null,
    changeOriginalAudioBlob: () => { },
    error: null,
    changeError: () => { },
    currentPath: "Home",
    changeCurrentPath: () => { },
});

export const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};
