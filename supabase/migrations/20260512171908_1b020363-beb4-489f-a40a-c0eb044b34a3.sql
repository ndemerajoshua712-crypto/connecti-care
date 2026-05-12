
-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'receptionist', 'lab_tech', 'pharmacist');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

-- Trigger to auto-create profile + default role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'receptionist'));
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Patients
CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  date_of_birth DATE,
  gender TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  blood_type TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Appointments
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES auth.users(id),
  scheduled_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Medical records (EHR)
CREATE TABLE public.medical_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES auth.users(id),
  diagnosis TEXT NOT NULL,
  treatment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lab tests
CREATE TABLE public.lab_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES auth.users(id),
  test_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Prescriptions
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES auth.users(id),
  medication TEXT NOT NULL,
  dosage TEXT,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dispensed_at TIMESTAMPTZ
);

-- Bills
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone authenticated can view, users update their own
CREATE POLICY "auth view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "self update profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles: authenticated can view all (to show role labels)
CREATE POLICY "auth view roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Patients: all staff can view; receptionists/admin create/update; admin delete
CREATE POLICY "staff view patients" ON public.patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "reception create patients" ON public.patients FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reception update patients" ON public.patients FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete patients" ON public.patients FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Appointments
CREATE POLICY "staff view appts" ON public.appointments FOR SELECT TO authenticated USING (true);
CREATE POLICY "reception create appts" ON public.appointments FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "staff update appts" ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));
CREATE POLICY "admin delete appts" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Medical records: doctors create/update; everyone view
CREATE POLICY "staff view records" ON public.medical_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctor create records" ON public.medical_records FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "doctor update records" ON public.medical_records FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

-- Lab tests
CREATE POLICY "staff view lab" ON public.lab_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctor request lab" ON public.lab_tests FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lab update tests" ON public.lab_tests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'lab_tech') OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'doctor'));

-- Prescriptions
CREATE POLICY "staff view rx" ON public.prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "doctor create rx" ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "pharm update rx" ON public.prescriptions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'pharmacist') OR public.has_role(auth.uid(), 'doctor') OR public.has_role(auth.uid(), 'admin'));

-- Bills
CREATE POLICY "staff view bills" ON public.bills FOR SELECT TO authenticated USING (true);
CREATE POLICY "reception create bills" ON public.bills FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "reception update bills" ON public.bills FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'receptionist') OR public.has_role(auth.uid(), 'admin'));
