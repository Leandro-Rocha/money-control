"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { verifyPinAction } from "@/lib/actions/auth";

interface PrivacyContextType {
  isPrivate: boolean;
  inactivityMinutes: number;
  isPinModalOpen: boolean;
  hideValues: () => void;
  openPinModal: () => void;
  closePinModal: () => void;
  togglePrivacy: () => void;
  verifyAndUnlock: (pin: string) => Promise<{ success: boolean; error?: string }>;
  setInactivityMinutes: (minutes: number) => void;
}

const PrivacyContext = createContext<PrivacyContextType | null>(null);

const STORAGE_INACTIVITY_KEY = "money_control_privacy_inactivity";
const STORAGE_PRIVATE_KEY = "money_control_privacy_active";
const DEFAULT_INACTIVITY_MINUTES = 5;

interface PrivacyProviderProps {
  children: React.ReactNode;
  initialPrivate?: boolean;
}

export function PrivacyProvider({ children, initialPrivate = false }: PrivacyProviderProps) {
  const [isPrivate, setIsPrivate] = useState<boolean>(initialPrivate);
  const [inactivityMinutes, setInactivityMinutesState] = useState<number>(DEFAULT_INACTIVITY_MINUTES);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const isFirstSyncRef = useRef<boolean>(true);

  // Inicializa preferências de inatividade e sincroniza estado de privacidade no mount
  useEffect(() => {
    try {
      const savedInactivity = localStorage.getItem(STORAGE_INACTIVITY_KEY);
      if (savedInactivity !== null) {
        const parsed = parseInt(savedInactivity, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          setInactivityMinutesState(parsed);
        }
      }

      const savedPrivate = sessionStorage.getItem(STORAGE_PRIVATE_KEY);
      const isDocumentPrivate = typeof document !== "undefined" && document.documentElement.classList.contains("privacy-active");
      if (savedPrivate === "true" || isDocumentPrivate) {
        setIsPrivate(true);
      } else if (savedPrivate === "false" && !initialPrivate) {
        setIsPrivate(false);
      }
    } catch {
      // Ignora falhas de localStorage (ex: modo restrito)
    }
  }, [initialPrivate]);

  // Sincroniza a classe CSS no documentElement, cookie e sessionStorage
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (isFirstSyncRef.current) {
      isFirstSyncRef.current = false;
      // Se o HTML/script já marcou privacy-active mas o state ainda não atualizou, não remove prematuramente
      if (document.documentElement.classList.contains("privacy-active") && !isPrivate) {
        return;
      }
    }

    if (isPrivate) {
      document.documentElement.classList.add("privacy-active");
      try {
        sessionStorage.setItem(STORAGE_PRIVATE_KEY, "true");
        document.cookie = `${STORAGE_PRIVATE_KEY}=true; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      } catch {}
    } else {
      document.documentElement.classList.remove("privacy-active");
      try {
        sessionStorage.setItem(STORAGE_PRIVATE_KEY, "false");
        document.cookie = `${STORAGE_PRIVATE_KEY}=false; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
      } catch {}
    }
  }, [isPrivate]);

  const hideValues = useCallback(() => {
    setIsPrivate(true);
  }, []);

  const openPinModal = useCallback(() => {
    setIsPinModalOpen(true);
  }, []);

  const closePinModal = useCallback(() => {
    setIsPinModalOpen(false);
  }, []);

  const togglePrivacy = useCallback(() => {
    if (isPrivate) {
      openPinModal();
    } else {
      hideValues();
    }
  }, [isPrivate, openPinModal, hideValues]);

  const verifyAndUnlock = useCallback(
    async (pin: string): Promise<{ success: boolean; error?: string }> => {
      const result = await verifyPinAction(pin);
      if (result.success) {
        setIsPrivate(false);
        setIsPinModalOpen(false);
        lastActivityRef.current = Date.now();
      }
      return result;
    },
    []
  );

  const setInactivityMinutes = useCallback((minutes: number) => {
    setInactivityMinutesState(minutes);
    try {
      localStorage.setItem(STORAGE_INACTIVITY_KEY, minutes.toString());
    } catch {}
  }, []);

  // Timer de inatividade (sem bloquear ao trocar de aba)
  useEffect(() => {
    if (inactivityMinutes <= 0) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const resetTimer = () => {
      const now = Date.now();
      // Throttle de 1 segundo para evitar chamadas excessivas em mousemove
      if (now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;

      if (timerRef.current) clearTimeout(timerRef.current);

      timerRef.current = setTimeout(() => {
        // Se inativo pelo tempo limite e ainda não estiver privado, oculta os valores
        setIsPrivate(true);
      }, inactivityMinutes * 60 * 1000);
    };

    // Inicia o timer inicial
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setIsPrivate(true);
    }, inactivityMinutes * 60 * 1000);

    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
    const handleEvent = () => resetTimer();

    events.forEach((evt) => window.addEventListener(evt, handleEvent, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((evt) => window.removeEventListener(evt, handleEvent));
    };
  }, [inactivityMinutes]);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivate,
        inactivityMinutes,
        isPinModalOpen,
        hideValues,
        openPinModal,
        closePinModal,
        togglePrivacy,
        verifyAndUnlock,
        setInactivityMinutes,
      }}
    >
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextType {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error("usePrivacy deve ser usado dentro de um PrivacyProvider");
  }
  return context;
}
