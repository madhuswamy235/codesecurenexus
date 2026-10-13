"use client";
import ProtectedWorkspace from "@/components/common/ProtectedWorkspace";
import SecurityCenter from "@/components/interview/SecurityCenter";
export default function SecurityPage() { return <ProtectedWorkspace eyebrow="Security monitoring"><SecurityCenter /></ProtectedWorkspace>; }
