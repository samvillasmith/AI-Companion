const ChatLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="relative">
      {/* Ensure this route uses theme background */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-background" />
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="min-h-[calc(100dvh-4rem)] flex flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};

export default ChatLayout;
