import {
  Mail,
  Globe,
  UserCheck,
  Phone,
  MapPin,
  User,
  Home,
  Car,
} from "lucide-react";

export const targetTypes = [
  {
    value: "email",
    label: "Email Address",
    icon: Mail,
    placeholder: "user@example.com",
  },
  {
    value: "domain",
    label: "Domain",
    icon: Globe,
    placeholder: "example.com",
  },
  {
    value: "username",
    label: "Username",
    icon: UserCheck,
    placeholder: "username123",
  },
  {
    value: "phone",
    label: "Phone Number",
    icon: Phone,
    placeholder: "+1234567890",
  },
  {
    value: "ip",
    label: "IP Address",
    icon: MapPin,
    placeholder: "192.168.1.1",
  },
  {
    value: "name",
    label: "Full Name",
    icon: User,
    placeholder: "First Last",
  },
  {
    value: "address",
    label: "Street Address",
    icon: Home,
    placeholder: "123 Main St, City, ST 12345",
  },
  {
    value: "license_plate",
    label: "License Plate",
    icon: Car,
    placeholder: "7ABC123",
  },
];
