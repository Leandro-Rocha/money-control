"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { verifyPinAction } from "@/lib/actions/auth";

interface PrivacyContextType {
  isPrivate: boolean;
  isPinModalOpen: boolean;
  hideValues: () => void;
  openPinModal: () => void;
  closePinModal: () => void;
  togglePrivacy: () => void;
  verifyAndUnlock: (pin: string) => Promise<{ success: boolean; error?: string }>;
}

const PrivacyContext = createContext<PrivacyContextType | null>(null);

const STORAGE_PRIVATE_KEY = "money_control_privacy_active";

interface PrivacyProviderProps {
  children: React.ReactNode;
  initialPrivate?: boolean;
}

export function PrivacyProvider({ children, initialPrivate = false }: PrivacyProviderProps) {
  const [isPrivate, setIsPrivate] = useState<boolean>(initialPrivate);
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const isFirstSyncRef = useRef<boolean>(true);

  // Sincroniza estado de privacidade no mount
  useEffect(() => {
    try {
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
      }
      return result;
    },
    []
  );

  return (
    <PrivacyContext.Provider
      value={{
        isPrivate,
        isPinModalOpen,
        hideValues,
        openPinModal,
        closePinModal,
        togglePrivacy,
        verifyAndUnlock,
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
