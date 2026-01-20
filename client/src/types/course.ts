export type Role = 'STUDENT' | 'ADMIN';

export type User = {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    provider: string;
    googleId: string | null;
    createdAt: string;
    updatedAt: string;
};

export type Course = {
    id: string;
    code: string;
    title: string;
    department: string | null;
    sections?: Section[];
    _count?: {
        sections: number;
    };
};

export type Section = {
    id: string;
    courseId: string;
    sectionNumber: string;
    capacity: number;
    enrolled: number;
    status: 'OPEN' | 'CLOSED';
    facultyInitials?: string;
    examDate?: string;
    labFacultyInitials?: string;
    labExamDate?: string;
    prerequisites?: string;
    lastUpdated: string;
    slots?: RoomSlot[];
};

export type RoomSlot = {
    id: string;
    day: string;
    startTime: number;
    endTime: number;
    roomNumber: string;
    building: string;
    type: 'CLASS' | 'LAB';
    sectionId: string | null;
};
