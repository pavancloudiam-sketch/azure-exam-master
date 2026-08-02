import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavSidebar } from "./NavSidebar";
import { mainNav, type NavItem } from "./navigation";

export function MobileNav({ items = mainNav }: { items?: NavItem[] }) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="min-h-11 min-w-11 md:hidden"
        >
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-6">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
        <NavSidebar items={items} heading="Navigation" onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}