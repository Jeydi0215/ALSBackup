import styles from "../css/EmployeeList.module.css";

const EmployeeList = () => {
  return (
    <div className={styles.EmployeeList}>
      <div className={styles.List_head}>
        <span>Juan Dela Cruz's History</span>
        <button>Back</button>
      </div>

      <div className={styles.List_inner}>
        <div className={styles.List_buttons}>
          <select name="" id="">
            <option value="">Monthly</option>
          </select>

          <div className={styles.Button_inner}>
            <button>Filter by Date</button>
            <button>Generate Report</button>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Clock In</th>
              <th>Break Out</th>
              <th>Break In</th>
              <th>Clock Out</th>
              <th>Working Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>2025-05-06</td>
              <td>09:00</td>
              <td>12:30</td>
              <td>13:00</td>
              <td>17:30</td>
              <td>8</td>
              <td>
                <select>
                  <option>Pending</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </td>
            </tr>
            <tr>
              <td>2025-05-07</td>
              <td>09:15</td>
              <td>12:00</td>
              <td>12:45</td>
              <td>18:00</td>
              <td>8</td>
              <td>
                <select>
                  <option>Pending</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </td>
            </tr>
            <tr>
              <td>2025-05-08</td>
              <td>08:50</td>
              <td>12:10</td>
              <td>13:00</td>
              <td>17:00</td>
              <td>7.5</td>
              <td>
                <select>
                  <option>Pending</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </td>
            </tr>
            <tr>
              <td>2025-05-09</td>
              <td>09:05</td>
              <td>12:20</td>
              <td>13:10</td>
              <td>18:10</td>
              <td>8</td>
              <td>
                <select>
                  <option>Pending</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </td>
            </tr>
            <tr>
              <td>2025-05-10</td>
              <td>09:30</td>
              <td>13:00</td>
              <td>13:30</td>
              <td>18:00</td>
              <td>7</td>
              <td>
                <select>
                  <option>Pending</option>
                  <option>Accepted</option>
                  <option>Rejected</option>
                </select>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeList;
