import { useQuery } from "@tanstack/react-query";

/**
 * Hook pour récupérer les informations du profil admin
 * Utilisé pour pré-remplir les formulaires de création d'attestation
 */
export function useAdminProfile() {
  const { data: admin, isLoading } = useQuery({
    queryKey: ["admin-profile"],
    queryFn: async () => {
      const res = await fetch("/api/admin");
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    admin,
    isLoading,
    // Formatage des dates pour les inputs
    birthDate: admin?.birthDate ? admin.birthDate.slice(0, 10) : "",
  };
}
