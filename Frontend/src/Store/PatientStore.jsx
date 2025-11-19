import { create } from 'zustand';

const usePatientStore = create((set) => ({
  patientData: null,
  // loading: false,
  // error: null,

  // to set patient data 
  setPatientData: (data) => set({ patientData: data }),

  // to update specific fields 
  updatePatientField: (field, value) => set((state) => ({
    patientData: { ...state.patientData, [field]: value }
  })),

  // setLoading: (isLoading) => set({ loading: isLoading }),
  // setError: (errorMsg) => set({ error: errorMsg, loading: false }),

  clearPatientData: () => set({ patientData: null, error: null })
}));

export default usePatientStore;