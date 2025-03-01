interface HeaderProps {
  title: string;
  rightSlot?: React.ReactNode;
}

function Header({ title, rightSlot }: HeaderProps) {
  return (
    <header className="flex items-center justify-between bg-base-100 px-2 py-[0.71875rem]">
      <h1 className="font-bold text-lg text-primary">{title}</h1>
      {rightSlot && rightSlot}
    </header>
  );
}

export default Header;
