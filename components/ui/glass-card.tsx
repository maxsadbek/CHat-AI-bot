import React from "react";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function GlassCard({
  children,
  className = "",
  hover = false,
}: GlassCardProps) {
  const baseClass = hover ? "glass-card-hover" : "glass-card";
  return (
    <div className={`${baseClass} ${className}`}>
      {children}
    </div>
  );
}
