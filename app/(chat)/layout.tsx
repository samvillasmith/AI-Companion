const ChatLayout = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <div className="relative h-screen overflow-hidden">
      {/* Background layer */}
      <div aria-hidden className="fixed inset-0 -z-10 bg-background" />
      
      {/* Full width container with proper height */}
      <div className="h-full w-full">
        {children}
      </div>
    </div>
  );
};

export default ChatLayout;