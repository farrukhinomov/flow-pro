namespace FlowPro.Domain.Attendance;

public enum WorkState
{
    NotWorking,
    Working,
    Break,
    Finished,
}

public enum WorkLocation
{
    Office,
    HomeOffice,
}

public enum TimeBookingType
{
    ClockIn,
    StartBreak,
    ResumeWork,
    ClockOut,
}

public enum BookingSource
{
    Web,
    Mobile,
    Terminal,
    Manual,
    System,
}
