import React from 'react';
import { clsx } from 'clsx';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, ...props }) => {
    return (
        <div 
            className={clsx("animate-pulse rounded-md bg-slate-200/80", className)} 
            {...props}
        />
    );
};

export const RoomSkeleton: React.FC = () => {
    return (
        <div className="w-full flex flex-col bg-white rounded-xl border border-slate-200 h-full p-0 overflow-hidden">
            <div className="p-2 border-b border-slate-100 space-y-2">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
            </div>
            <div className="flex-1 p-2 space-y-2 bg-slate-50/50">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
            </div>
        </div>
    );
};
