
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Staff } from '../types';
import { loadStaffList, saveStaffList as saveStaffService } from '../services/storageService';

interface StaffContextType {
    staffList: Staff[];
    updateStaffList: (newStaff: Staff[]) => Promise<void>;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

export const StaffProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [staffList, setStaffList] = useState<Staff[]>([]);

    useEffect(() => {
        const fetchStaff = async () => {
            const saved = await loadStaffList();
            // Start empty if no DB connection/data. User must seed or import.
            setStaffList(saved || []);
        };
        fetchStaff();
    }, []);

    const updateStaffList = async (newStaff: Staff[]) => {
        setStaffList(newStaff);
        await saveStaffService(newStaff);
    };

    return (
        <StaffContext.Provider value={{ staffList, updateStaffList }}>
            {children}
        </StaffContext.Provider>
    );
};

export const useStaff = () => {
    const context = useContext(StaffContext);
    if (!context) throw new Error("useStaff must be used within a StaffProvider");
    return context;
};
