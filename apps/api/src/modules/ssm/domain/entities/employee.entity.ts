import { TenantId } from "../value-objects/tenant-id.vo";

export interface EmployeeProps {
  id: string;
  tenantId: TenantId;
  fullName: string;
  email: string;
  active: boolean;
}

export class Employee {
  constructor(private readonly props: EmployeeProps) {}

  get id() {
    return this.props.id;
  }

  get tenantId() {
    return this.props.tenantId;
  }

  get fullName() {
    return this.props.fullName;
  }

  deactivate() {
    this.props.active = false;
  }
}
