import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  BusinessIdentity,
  FALLBACK_IDENTITY,
  fetchBusinessIdentity,
} from '../api/business';

interface BusinessContextValue {
  business: BusinessIdentity;
  loading: boolean;
}

const BusinessContext = createContext<BusinessContextValue>({
  business: FALLBACK_IDENTITY,
  loading: true,
});

export const BusinessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [business, setBusiness] = useState<BusinessIdentity>(FALLBACK_IDENTITY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBusinessIdentity()
      .then(setBusiness)
      .catch((err) => {
        // Si el backend no responde se mantiene FALLBACK_IDENTITY: la página
        // sigue funcionando en lugar de quedarse sin nombre ni datos.
        console.error('[business] no se pudo cargar la identidad:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <BusinessContext.Provider value={{ business, loading }}>
      {children}
    </BusinessContext.Provider>
  );
};

export const useBusiness = () => useContext(BusinessContext);
