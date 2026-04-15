"use client";

import React, { useState, useEffect, useRef } from "react";
import { Input } from "./input";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

/**
 * Composant DateInput pour afficher les dates au format français (jj/mm/aaaa)
 * tout en stockant la valeur au format ISO (aaaa-mm-jj)
 */
export function DateInput({ value, onChange, ...props }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isInternalChange = useRef(false);

  // Formate la valeur ISO (aaaa-mm-jj) vers le format français (jj/mm/aaaa) pour l'affichage
  useEffect(() => {
    if (value) {
      // S'assurer que la valeur est au format yyyy-mm-dd
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        const day = String(date.getUTCDate()).padStart(2, "0");
        const month = String(date.getUTCMonth() + 1).padStart(2, "0");
        const year = date.getUTCFullYear();
        setDisplayValue(`${day}/${month}/${year}`);
      } else {
        setDisplayValue(value);
      }
    } else {
      setDisplayValue("");
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isInternalChange.current) {
      return;
    }

    const inputValue = e.target.value;

    // Si l'input est vide, transmettre tel quel
    if (!inputValue) {
      setDisplayValue("");
      onChange?.(e);
      return;
    }

    // Auto-formatage pendant la saisie : ajouter les slashes automatiquement
    let formatted = inputValue.replace(/\D/g, ""); // Garder seulement les chiffres
    if (formatted.length > 8) {
      formatted = formatted.slice(0, 8);
    }

    if (formatted.length >= 5) {
      formatted = `${formatted.slice(0, 2)}/${formatted.slice(2, 4)}/${formatted.slice(4)}`;
    } else if (formatted.length >= 3) {
      formatted = `${formatted.slice(0, 2)}/${formatted.slice(2)}`;
    } else {
      // No change
    }

    setDisplayValue(formatted);

    // Si la date est complète (jj/mm/aaaa), convertir en ISO et déclencher onChange
    const parts = formatted.split("/");
    if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
      const [day, month, year] = parts;
      const dayNum = Number(day);
      const monthNum = Number(month);
      const yearNum = Number(year);

      // Validation basique
      if (
        dayNum >= 1 && dayNum <= 31 &&
        monthNum >= 1 && monthNum <= 12 &&
        yearNum >= 1900 && yearNum <= 2100
      ) {
        const isoValue = `${year}-${month}-${day}`;

        // Créer un événement avec la valeur ISO
        isInternalChange.current = true;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;

        if (nativeInputValueSetter && inputRef.current) {
          nativeInputValueSetter.call(inputRef.current, isoValue);
        }

        // Mettre à jour l'affichage avec le format français
        setDisplayValue(`${day}/${month}/${year}`);

        // Déclencher le onChange avec la valeur ISO
        if (inputRef.current) {
          const event = new Event("input", { bubbles: true }) as any;
          event.simulated = true;
          inputRef.current.dispatchEvent(event);
          onChange?.(event as any);
        }

        isInternalChange.current = false;
        return;
      }
    }

    // Si le format n'est pas complet, mettre à jour l'affichage sans déclencher onChange
    e.target.value = formatted;
  };

  return (
    <Input
      ref={inputRef}
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder="jj/mm/aaaa"
      inputMode="numeric"
    />
  );
}
